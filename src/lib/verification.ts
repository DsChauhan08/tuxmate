/**
 * Verification status fetching for Flatpak (Flathub) and Snap (Snapcraft) packages.
 * 
 * Flathub API: https://flathub.org/api/v2/collection/verified
 * Snapcraft API: https://api.snapcraft.io/v2/snaps/info/{name}
 */

// Types
export interface FlathubVerificationResponse {
    hits: Array<{
        app_id: string;
        verification_verified: boolean;
        verification_method?: string;
        verification_website?: string;
    }>;
    totalHits: number;
    totalPages: number;
}

export interface SnapInfoResponse {
    snap: {
        publisher: {
            validation?: string;  // "verified" | "unproven" | undefined
            'display-name': string;
            username: string;
        };
    };
}

// Module-level cache to avoid refetching
let flathubVerifiedCache: Set<string> | null = null;
const snapVerifiedCache = new Map<string, boolean>();

/**
 * Known verified Snap publishers.
 * 
 * The Snapcraft API doesn't support CORS for browser clients, so we use a
 * static list of known verified publishers. This list was compiled from
 * official sources and covers major publishers.
 * 
 * To update: Run this command and look for "validation": "verified"
 * curl -s "https://api.snapcraft.io/v2/snaps/info/{snap_name}" -H "Snap-Device-Series: 16" | jq '.snap.publisher'
 */
const KNOWN_VERIFIED_SNAP_PACKAGES = new Set([
    // Mozilla - verified publisher
    'firefox',
    'thunderbird',
    // Canonical/Ubuntu - verified publisher  
    'chromium',
    'vlc',
    // Brave Software - verified publisher
    'brave',
    // Spotify - verified publisher
    'spotify',
    // Microsoft - verified publisher
    'code',  // VS Code
    // JetBrains - verified publisher
    'intellij-idea-community',
    'intellij-idea-ultimate',
    'pycharm-community',
    'pycharm-professional',
    // Slack - verified publisher
    'slack',
    // Discord - verified publisher
    'discord',
    // Signal - verified publisher
    'signal-desktop',
    // Telegram - verified publisher
    'telegram-desktop',
    // Zoom - verified publisher
    'zoom-client',
    // Obsidian - verified publisher
    'obsidian',
    // Bitwarden - verified publisher
    'bitwarden',
    // Blender - verified publisher
    'blender',
    // GIMP - verified publisher (packaged by snapcrafters)
    'gimp',
    // Inkscape - verified publisher
    'inkscape',
    // Krita - verified publisher
    'krita',
    // LibreOffice - verified publisher
    'libreoffice',
    // OBS Studio - verified publisher
    'obs-studio',
    // VLC - verified publisher
    'vlc',
    // Node.js - verified publisher
    'node',
    // Go - verified publisher  
    'go',
    // Rustup - verified publisher
    'rustup',
    // Ruby - verified publisher
    'ruby',
    // CMake - verified publisher
    'cmake',
    // Docker - verified publisher
    'docker',
    // kubectl - verified publisher
    'kubectl',
    // Steam - verified publisher
    'steam',
    // RetroArch - verified publisher
    'retroarch',
    // Vivaldi - verified publisher
    'vivaldi',
]);

/**
 * Fetch all verified Flatpak app IDs from Flathub.
 * Uses pagination to ensure we get all apps (currently ~1000 verified).
 */
export async function fetchFlathubVerifiedApps(): Promise<Set<string>> {
    // Return cached result if available
    if (flathubVerifiedCache !== null) {
        return flathubVerifiedCache;
    }

    const verifiedApps = new Set<string>();

    try {
        // Flathub limits per_page to 1000, fetch all pages if needed
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(
                `https://flathub.org/api/v2/collection/verified?page=${page}&per_page=250`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    // Short timeout to avoid blocking UI
                    signal: AbortSignal.timeout(10000),
                }
            );

            if (!response.ok) {
                console.warn(`Flathub API returned ${response.status}, treating as empty`);
                break;
            }

            const data: FlathubVerificationResponse = await response.json();

            for (const hit of data.hits) {
                if (hit.verification_verified && hit.app_id) {
                    verifiedApps.add(hit.app_id);
                }
            }

            // Check if there are more pages
            hasMore = page < data.totalPages;
            page++;

            // Safety limit to prevent infinite loops
            if (page > 10) break;
        }
    } catch (error) {
        // Graceful degradation: log warning but don't break the app
        console.warn('Failed to fetch Flathub verification data:', error);
    }

    // Cache the result
    flathubVerifiedCache = verifiedApps;
    return verifiedApps;
}

/**
 * Fetch verification status for a single Snap package.
 * Returns true if publisher has "verified" validation status.
 */
export async function fetchSnapVerification(snapName: string): Promise<boolean> {
    // Check cache first
    if (snapVerifiedCache.has(snapName)) {
        return snapVerifiedCache.get(snapName)!;
    }

    try {
        // Snap names may have --classic suffix, strip it
        const cleanName = snapName.split(' ')[0];

        const response = await fetch(
            `https://api.snapcraft.io/v2/snaps/info/${encodeURIComponent(cleanName)}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Snap-Device-Series': '16',  // Required header
                },
                signal: AbortSignal.timeout(5000),
            }
        );

        if (!response.ok) {
            snapVerifiedCache.set(snapName, false);
            return false;
        }

        const data: SnapInfoResponse = await response.json();
        const isVerified = data.snap?.publisher?.validation === 'verified';

        // Cache the result
        snapVerifiedCache.set(snapName, isVerified);
        return isVerified;
    } catch (error) {
        // Graceful degradation
        console.warn(`Failed to fetch Snap verification for ${snapName}:`, error);
        snapVerifiedCache.set(snapName, false);
        return false;
    }
}

/**
 * Batch fetch verification status for multiple Snap packages.
 * Limits concurrent requests to avoid rate limiting.
 */
export async function fetchAllSnapVerifications(
    snapPackages: string[]
): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const uniquePackages = [...new Set(snapPackages)];

    // Process in batches of 5 to avoid rate limiting
    const BATCH_SIZE = 5;

    for (let i = 0; i < uniquePackages.length; i += BATCH_SIZE) {
        const batch = uniquePackages.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (pkg) => {
                const isVerified = await fetchSnapVerification(pkg);
                return [pkg, isVerified] as const;
            })
        );

        for (const [pkg, isVerified] of batchResults) {
            results.set(pkg, isVerified);
        }
    }

    return results;
}

/**
 * Check if a Flatpak app ID is verified.
 * Must call fetchFlathubVerifiedApps() first to populate cache.
 */
export function isFlathubVerified(appId: string): boolean {
    return flathubVerifiedCache?.has(appId) ?? false;
}

/**
 * Check if a Snap package is from a verified publisher.
 * Uses a static list of known verified packages since the Snapcraft API
 * doesn't support CORS for browser clients.
 */
export function isSnapVerified(snapName: string): boolean {
    // Strip --classic suffix and get base package name
    const cleanName = snapName.split(' ')[0];

    // First check static list (always available, no CORS issues)
    if (KNOWN_VERIFIED_SNAP_PACKAGES.has(cleanName)) {
        return true;
    }

    // Fall back to cache (populated if API somehow succeeded)
    return snapVerifiedCache.get(cleanName) ?? snapVerifiedCache.get(snapName) ?? false;
}

/**
 * Clear all caches (useful for testing or forcing refresh).
 */
export function clearVerificationCache(): void {
    flathubVerifiedCache = null;
    snapVerifiedCache.clear();
}
