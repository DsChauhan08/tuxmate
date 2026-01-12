// Nix declarative config generator

import { type PackageInfo } from './shared';
import { isUnfreePackage } from '../nixUnfree';

export function generateNixConfig(packages: PackageInfo[]): string {
    const validPackages = packages.filter(p => p.pkg.trim());
    if (validPackages.length === 0) return '# No packages selected';

    const sortedPkgs = validPackages.map(p => p.pkg.trim()).sort();
    const packageList = sortedPkgs.map(pkg => `    ${pkg}`).join('\n');

    // Add unfree warning if needed
    const unfreePkgs = sortedPkgs.filter(pkg => isUnfreePackage(pkg));
    const unfreeComment = unfreePkgs.length > 0
        ? `# Unfree: ${unfreePkgs.join(', ')}\n# Requires: nixpkgs.config.allowUnfree = true;\n\n`
        : '';

    return `${unfreeComment}environment.systemPackages = with pkgs; [
${packageList}
];`;
}
