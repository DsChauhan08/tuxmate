// Flatpak/Snap verification status - shows badges for verified publishers
// Data is fetched at build time to avoid CORS issues with Flathub API

import verifiedFlatpaks from './verified-flatpaks.json';
import verifiedSnaps from './verified-snaps.json';

// Load static lists (fetched at build time)
const VERIFIED_FLATPAK_APPS = new Set(verifiedFlatpaks.apps);
const VERIFIED_SNAP_PACKAGES = new Set(verifiedSnaps.apps);

// Check if a Flatpak app ID is verified
export function isFlathubVerified(appId: string): boolean {
    return VERIFIED_FLATPAK_APPS.has(appId);
}

// Check if a Snap package is from a verified publisher
export function isSnapVerified(snapName: string): boolean {
    const cleanName = snapName.split(' ')[0];
    return VERIFIED_SNAP_PACKAGES.has(cleanName);
}

