import { distros, apps, type DistroId } from './data';
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

interface GenerateOptions {
    distroId: DistroId;
    selectedAppIds: Set<string>;
    helper?: 'yay' | 'paru';
    isFlatpakEnabled?: boolean;
}

const FLATPAK_ELIGIBLE_DISTROS: DistroId[] = ['ubuntu', 'debian', 'arch', 'fedora', 'opensuse'];

function getFlatpakFallbackPackages(selectedAppIds: Set<string>, distroId: DistroId) {
    return Array.from(selectedAppIds)
        .map(id => apps.find(a => a.id === id))
        .filter(app => {
            if (!app) return false;
            if (app.targets[distroId]) return false;
            return !!app.targets['flatpak'];
        })
        .map(app => ({ app: app!, pkg: app!.targets['flatpak']! }));
}

export function generateInstallScript(options: GenerateOptions): string {
    const { distroId, selectedAppIds, helper = 'yay', isFlatpakEnabled = false } = options;
    const distro = distros.find(d => d.id === distroId);

    if (!distro) return '#!/bin/bash\necho "Error: Unknown distribution"\nexit 1';

    const packages = getSelectedPackages(selectedAppIds, distroId);
    const flatpakFallbacks = (isFlatpakEnabled && FLATPAK_ELIGIBLE_DISTROS.includes(distroId))
        ? getFlatpakFallbackPackages(selectedAppIds, distroId)
        : [];

    if (packages.length === 0 && flatpakFallbacks.length === 0) {
        return '#!/bin/bash\necho "No packages selected"\nexit 0';
    }

    let script = '';

    if (packages.length > 0) {
        switch (distroId) {
            case 'ubuntu': script = generateUbuntuScript(packages); break;
            case 'debian': script = generateDebianScript(packages); break;
            case 'arch': script = generateArchScript(packages, helper); break;
            case 'fedora': script = generateFedoraScript(packages); break;
            case 'opensuse': script = generateOpenSUSEScript(packages); break;
            case 'nix': script = generateNixConfig(packages); break;
            case 'flatpak': script = generateFlatpakScript(packages); break;
            case 'snap': script = generateSnapScript(packages); break;
            case 'homebrew': script = generateHomebrewScript(packages); break;
            default: script = '#!/bin/bash\necho "Unsupported distribution"\nexit 1'; break;
        }
    }

    if (flatpakFallbacks.length > 0) {
        const appendedSection = generateFlatpakScript(flatpakFallbacks, { isAppended: true, existingTotal: packages.length });
        if (packages.length > 0) {
            // Strip the final print_summary and restart message from the primary script,
            // since the appended flatpak section will handle that.
            script = script.replace(/\nprint_summary\n[^\n]*\n[^\n]*$/, '');
            script += '\n' + appendedSection;
        } else {
            script = generateFlatpakScript(flatpakFallbacks);
        }
    }

    return script;
}

export function generateCommandline(options: GenerateOptions): string {
    const { selectedAppIds, distroId } = options;
    const packages = getSelectedPackages(selectedAppIds, distroId);
    if (packages.length === 0) return '# No packages selected';

    const pkgList = packages.map(p => p.pkg).join(' ');

    switch (distroId) {
        case 'ubuntu':
        case 'debian': return `sudo apt install -y ${pkgList}`;
        case 'arch': return `yay -S --needed --noconfirm ${pkgList}`;
        case 'fedora': return `sudo dnf install -y ${pkgList}`;
        case 'opensuse': return `sudo zypper install -y ${pkgList}`;
        case 'nix': return generateNixConfig(packages);
        case 'flatpak': return `flatpak install flathub -y ${pkgList}`;
        case 'snap':
            if (packages.length === 1) return `sudo snap install ${pkgList}`;
            return packages.map(p => `sudo snap install ${p.pkg}`).join(' && ');
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
            return parts.join(' && ') || '# No packages selected';
        }
        default: return `# Install: ${pkgList}`;
    }
}
