// AUR package detection for Arch users
// Identifies packages that come from the AUR vs official repos

import aurPackages from './aur-packages.json';

// Suffixes that scream "I'm from the AUR"
export const AUR_PATTERNS = ['-bin', '-git', '-appimage'];

// Known AUR packages without standard suffixes
// Extracted to JSON for cleaner code
export const KNOWN_AUR_PACKAGES = new Set(aurPackages.packages);

// Check if a package name is an AUR package
export function isAurPackage(packageName: string): boolean {
    if (KNOWN_AUR_PACKAGES.has(packageName)) {
        return true;
    }
    return AUR_PATTERNS.some(pattern => packageName.endsWith(pattern));
}

