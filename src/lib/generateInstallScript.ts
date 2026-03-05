// Main entry point for generating install scripts.
// Each distro has its own module - keeps things sane.

import { distros, type DistroId } from './data';
import {
    getSelectedPackages,
    generateUbuntuScript,
    generateDebianScript,
    generateArchScript,
    generateFedoraScript,
    generateOpenSUSEScript,
    generateNixConfig,
    generateFlatpakScript,
    generateSnapScript,
    generateHomebrewScript,
} from './scripts';

interface ScriptOptions {
    distroId: DistroId;
    selectedAppIds: Set<string>;
    helper?: 'yay' | 'paru';
    isFlatpakEnabled?: boolean;
}

// Full install script for download. Nix gets a config file, others get shell scripts.
export function generateInstallScript(options: ScriptOptions): string {
    const { distroId, selectedAppIds, helper = 'yay', isFlatpakEnabled = false } = options;
    const distro = distros.find(d => d.id === distroId);

    if (!distro) return '#!/bin/bash\necho "Error: Unknown distribution"\nexit 1';

    const packages = getSelectedPackages(selectedAppIds, distroId);

    const flatpakFallbackPkgs = isFlatpakEnabled && distroId !== 'flatpak'
        ? getSelectedPackages(selectedAppIds, 'flatpak').filter(fpkg => !packages.find(p => p.app.id === fpkg.app.id))
        : [];

    if (packages.length === 0 && flatpakFallbackPkgs.length === 0) return '#!/bin/bash\necho "No packages selected"\nexit 0';

    let primaryScript = '';

    switch (distroId) {
        case 'ubuntu': primaryScript = generateUbuntuScript(packages); break;
        case 'debian': primaryScript = generateDebianScript(packages); break;
        case 'arch': primaryScript = generateArchScript(packages, helper); break;
        case 'fedora': primaryScript = generateFedoraScript(packages); break;
        case 'opensuse': primaryScript = generateOpenSUSEScript(packages); break;
        case 'nix': primaryScript = generateNixConfig(packages); break;
        case 'flatpak': primaryScript = generateFlatpakScript(packages); break;
        case 'snap': primaryScript = generateSnapScript(packages); break;
        case 'homebrew': primaryScript = generateHomebrewScript(packages); break;
        default: return '#!/bin/bash\necho "Unsupported distribution"\nexit 1';
    }

    if (distroId === 'nix') {
        return primaryScript;
    }

    if (flatpakFallbackPkgs.length > 0) {
        primaryScript = primaryScript.replace(/print_summary[\n\r]*echo[\n\r]*info "Restart session for apps in menu."$/, '');
        primaryScript = primaryScript.replace(/print_summary$/, '');
        const appendedFlatpakScript = generateFlatpakScript(flatpakFallbackPkgs, true);
        return primaryScript + '\n' + appendedFlatpakScript + '\nprint_summary\necho\ninfo "Restart session for apps in menu."\n';
    }

    return primaryScript;
}

// Quick one-liner for copy-paste warriors
export function generateSimpleCommand(selectedAppIds: Set<string>, distroId: DistroId, isFlatpakEnabled: boolean = false): string {
    const packages = getSelectedPackages(selectedAppIds, distroId);

    const flatpakFallbackPkgs = isFlatpakEnabled && distroId !== 'flatpak'
        ? getSelectedPackages(selectedAppIds, 'flatpak').filter(fpkg => !packages.find(p => p.app.id === fpkg.app.id))
        : [];

    if (packages.length === 0 && flatpakFallbackPkgs.length === 0) return '# No packages selected';

    const pkgList = packages.map(p => p.pkg).join(' ');
    const flatpakPkgList = flatpakFallbackPkgs.map(p => p.pkg).join(' ');

    let primaryCmd = '';

    switch (distroId) {
        case 'ubuntu':
        case 'debian': primaryCmd = pkgList ? `sudo apt install -y ${pkgList}` : ''; break;
        case 'arch': primaryCmd = pkgList ? `yay -S --needed --noconfirm ${pkgList}` : ''; break;
        case 'fedora': primaryCmd = pkgList ? `sudo dnf install -y ${pkgList}` : ''; break;
        case 'opensuse': primaryCmd = pkgList ? `sudo zypper install -y ${pkgList}` : ''; break;
        case 'nix': return generateNixConfig(packages);
        case 'flatpak': return `flatpak install flathub -y ${pkgList}`;
        case 'snap':
            if (packages.length === 1) primaryCmd = `sudo snap install ${pkgList}`;
            else primaryCmd = packages.map(p => `sudo snap install ${p.pkg}`).join(' && ');
            break;
        case 'homebrew': {
            const formulae = packages.filter(p => !p.pkg.startsWith('--cask '));
            const casks = packages.filter(p => p.pkg.startsWith('--cask '));
            const parts = [];
            if (formulae.length > 0) {
                parts.push(`brew install ${formulae.map(p => p.pkg).join(' ')}`);
            }
            if (casks.length > 0) {
                parts.push(`brew install --cask ${casks.map(p => p.pkg.replace('--cask ', '')).join(' ')}`);
            }
            primaryCmd = parts.join(' && ');
            break;
        }
        default: primaryCmd = pkgList ? `# Install: ${pkgList}` : ''; break;
    }

    if (flatpakFallbackPkgs.length > 0) {
        const flatpakCmd = `flatpak install flathub -y ${flatpakPkgList}`;
        if (primaryCmd) {
            return `${primaryCmd} && ${flatpakCmd}`;
        }
        return flatpakCmd;
    }

    return primaryCmd || '# No packages selected';
}
