// Nix unfree package detection - these require allowUnfree = true

import unfreeData from './nix-unfree.json';

// Loaded from JSON source
export const KNOWN_UNFREE_PACKAGES = new Set(unfreeData.packages);

export function isUnfreePackage(pkg: string): boolean {
    const cleanPkg = pkg.trim().toLowerCase();

    // Direct match
    if (KNOWN_UNFREE_PACKAGES.has(cleanPkg)) return true;

    // Nested packages like jetbrains.idea-ultimate
    // We iterate because the set is small (matches original logic)
    for (const unfree of KNOWN_UNFREE_PACKAGES) {
        if (cleanPkg.includes(unfree)) return true;
    }

    return false;
}

