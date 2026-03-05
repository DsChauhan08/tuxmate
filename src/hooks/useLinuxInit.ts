'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { distros, apps, type DistroId } from '@/lib/data';
import { isAurPackage } from '@/lib/aur';
import { isUnfreePackage } from '@/lib/nixUnfree';

// Re-export for backwards compatibility
export { isAurPackage, AUR_PATTERNS, KNOWN_AUR_PACKAGES } from '@/lib/aur';

// Everything the app needs to work

export interface UseLinuxInitReturn {
    selectedDistro: DistroId;
    selectedApps: Set<string>;
    setSelectedDistro: (distroId: DistroId) => void;
    toggleApp: (appId: string) => void;
    selectAll: () => void;
    clearAll: () => void;
    isAppAvailable: (appId: string) => boolean;
    getPackageName: (appId: string) => string | null;
    generatedCommand: string;
    selectedCount: number;
    availableCount: number;
    isFlatpakEnabled: boolean;
    toggleFlatpakEnabled: (enabled: boolean) => void;
    // Arch/AUR specific
    hasYayInstalled: boolean;
    setHasYayInstalled: (value: boolean) => void;
    selectedHelper: 'yay' | 'paru';
    setSelectedHelper: (helper: 'yay' | 'paru') => void;
    hasAurPackages: boolean;
    aurPackageNames: string[];
    aurAppNames: string[];
    // Nix unfree specific
    hasUnfreePackages: boolean;
    unfreeAppNames: string[];
    // Hydration state
    isHydrated: boolean;
}

const STORAGE_KEY_DISTRO = 'linuxinit_distro';
const STORAGE_KEY_APPS = 'linuxinit_apps';
const STORAGE_KEY_YAY = 'linuxinit_yay_installed';
const STORAGE_KEY_HELPER = 'linuxinit_selected_helper';
const STORAGE_KEY_FLATPAK = 'linuxinit_flatpak_enabled';

export function useLinuxInit(): UseLinuxInitReturn {
    const [selectedDistro, setSelectedDistroState] = useState<DistroId>('ubuntu');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [isFlatpakEnabled, setIsFlatpakEnabled] = useState(false);
    const [hasYayInstalled, setHasYayInstalled] = useState(false);
    const [selectedHelper, setSelectedHelper] = useState<'yay' | 'paru'>('yay');
    const [hydrated, setHydrated] = useState(false);

    // Load saved preferences from localStorage
    useEffect(() => {
        try {
            const savedDistro = localStorage.getItem(STORAGE_KEY_DISTRO) as DistroId | null;
            const savedApps = localStorage.getItem(STORAGE_KEY_APPS);
            const savedYay = localStorage.getItem(STORAGE_KEY_YAY);
            const savedHelper = localStorage.getItem(STORAGE_KEY_HELPER) as 'yay' | 'paru' | null;
            const savedFlatpak = localStorage.getItem(STORAGE_KEY_FLATPAK);

            if (savedDistro && distros.some(d => d.id === savedDistro)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedDistroState(savedDistro);
            }

            if (savedApps) {
                const appIds = JSON.parse(savedApps) as string[];
                // Filter to only valid app IDs that are available on the distro
                const validApps = appIds.filter(id => {
                    const app = apps.find(a => a.id === id);
                    if (!app) return false;
                    const pkg = app.targets[savedDistro || 'ubuntu'];
                    return pkg !== undefined && pkg !== null;
                });
                setSelectedApps(new Set(validApps));
            }

            if (savedYay === 'true') {
                setHasYayInstalled(true);
            }

            if (savedHelper === 'paru') {
                setSelectedHelper('paru');
            }

            if (savedFlatpak === 'true') {
                setIsFlatpakEnabled(true);
            }
        } catch {
            // Ignore localStorage errors
        }
        setHydrated(true);
    }, []);

    // Save to localStorage whenever state changes (but not on first render)
    useEffect(() => {
        if (!hydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY_DISTRO, selectedDistro);
            localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify([...selectedApps]));
            localStorage.setItem(STORAGE_KEY_YAY, hasYayInstalled.toString());
            localStorage.setItem(STORAGE_KEY_HELPER, selectedHelper);
            localStorage.setItem(STORAGE_KEY_FLATPAK, isFlatpakEnabled.toString());
        } catch {
            // Ignore localStorage errors
        }
    }, [selectedDistro, selectedApps, hasYayInstalled, selectedHelper, isFlatpakEnabled, hydrated]);

    // Compute AUR package info for Arch
    const aurPackageInfo = useMemo(() => {
        if (selectedDistro !== 'arch') {
            return { hasAur: false, packages: [] as string[], appNames: [] as string[] };
        }

        const aurPkgs: string[] = [];
        const aurAppNames: string[] = [];
        selectedApps.forEach(appId => {
            const app = apps.find(a => a.id === appId);
            if (app) {
                const pkg = app.targets['arch'];
                if (pkg && isAurPackage(pkg)) {
                    aurPkgs.push(pkg);
                    aurAppNames.push(app.name);
                }
            }
        });

        return { hasAur: aurPkgs.length > 0, packages: aurPkgs, appNames: aurAppNames };
    }, [selectedDistro, selectedApps]);

    const toggleFlatpakEnabled = useCallback((enabled: boolean) => {
        if (['flatpak', 'homebrew', 'nix'].includes(selectedDistro)) {
            setIsFlatpakEnabled(false);
            return;
        }

        setIsFlatpakEnabled(enabled);

        if (!enabled) {
            setSelectedApps(prev => {
                const newSelected = new Set<string>();
                prev.forEach(appId => {
                    const app = apps.find(a => a.id === appId);
                    if (app) {
                        const pkg = app.targets[selectedDistro];
                        if (pkg !== undefined && pkg !== null) {
                            newSelected.add(appId);
                        }
                    }
                });
                return newSelected;
            });
        }
    }, [selectedDistro]);

    // Compute unfree package info for Nix
    const unfreePackageInfo = useMemo(() => {
        if (selectedDistro !== 'nix') {
            return { hasUnfree: false, appNames: [] as string[] };
        }

        const unfreeAppNames: string[] = [];
        selectedApps.forEach(appId => {
            const app = apps.find(a => a.id === appId);
            if (app) {
                const pkg = app.targets['nix'];
                if (pkg && isUnfreePackage(pkg)) {
                    unfreeAppNames.push(app.name);
                }
            }
        });

        return { hasUnfree: unfreeAppNames.length > 0, appNames: unfreeAppNames };
    }, [selectedDistro, selectedApps]);

    const isAppAvailable = useCallback((appId: string): boolean => {
        const app = apps.find(a => a.id === appId);
        if (!app) return false;
        const packageName = app.targets[selectedDistro];
        if (packageName !== undefined && packageName !== null) {
            return true;
        }
        if (isFlatpakEnabled && app.targets['flatpak']) {
            return true;
        }
        return false;
    }, [selectedDistro, isFlatpakEnabled]);

    const getPackageName = useCallback((appId: string): string | null => {
        const app = apps.find(a => a.id === appId);
        if (!app) return null;
        return app.targets[selectedDistro] ?? null;
    }, [selectedDistro]);

    const setSelectedDistro = useCallback((distroId: DistroId) => {
        setSelectedDistroState(distroId);

        if (['flatpak', 'homebrew', 'nix'].includes(distroId)) {
            setIsFlatpakEnabled(false);
        }

        setSelectedApps(prevSelected => {
            const newSelected = new Set<string>();
            prevSelected.forEach(appId => {
                const app = apps.find(a => a.id === appId);
                if (app) {
                    const packageName = app.targets[distroId];
                    const canUseFlatpak = isFlatpakEnabled && !['flatpak', 'homebrew', 'nix'].includes(distroId);
                    if ((packageName !== undefined && packageName !== null) || (canUseFlatpak && app.targets['flatpak'])) {
                        newSelected.add(appId);
                    }
                }
            });
            return newSelected;
        });
    }, [isFlatpakEnabled]);

    const toggleApp = useCallback((appId: string) => {
        // Check availability inline to avoid stale closure
        const app = apps.find(a => a.id === appId);
        if (!app) return;
        const pkg = app.targets[selectedDistro];
        const flatpakPkg = app.targets['flatpak'];

        if ((pkg === undefined || pkg === null) && (!isFlatpakEnabled || !flatpakPkg)) {
            return;
        }

        setSelectedApps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(appId)) {
                newSet.delete(appId);
            } else {
                newSet.add(appId);
            }
            return newSet;
        });
    }, [selectedDistro]);

    const selectAll = useCallback(() => {
        const allAvailable = apps
            .filter(app => {
                const pkg = app.targets[selectedDistro];
                return (pkg !== undefined && pkg !== null) || (isFlatpakEnabled && app.targets['flatpak']);
            })
            .map(app => app.id);
        setSelectedApps(new Set(allAvailable));
    }, [selectedDistro, isFlatpakEnabled]);

    const clearAll = useCallback(() => {
        setSelectedApps(new Set());
    }, []);

    const availableCount = useMemo(() => {
        return apps.filter(app => {
            const pkg = app.targets[selectedDistro];
            return (pkg !== undefined && pkg !== null) || (isFlatpakEnabled && app.targets['flatpak']);
        }).length;
    }, [selectedDistro, isFlatpakEnabled]);

    const generatedCommand = useMemo(() => {
        if (selectedApps.size === 0) {
            return '# Select apps above to generate command';
        }

        const distro = distros.find(d => d.id === selectedDistro);
        if (!distro) return '';

        const packageNames: string[] = [];
        const flatpakFallbackPkgs: string[] = [];

        selectedApps.forEach(appId => {
            const app = apps.find(a => a.id === appId);
            if (app) {
                const pkg = app.targets[selectedDistro];
                if (pkg) {
                    packageNames.push(pkg);
                } else if (isFlatpakEnabled && app.targets['flatpak']) {
                    flatpakFallbackPkgs.push(app.targets['flatpak']);
                }
            }
        });

        if (packageNames.length === 0 && flatpakFallbackPkgs.length === 0) return '# No packages selected';

        let primaryCmd = '';

        if (selectedDistro === 'nix') {
            const sortedPkgs = packageNames.filter(p => p.trim()).sort();
            const pkgList = sortedPkgs.map(p => `    ${p}`).join('\n');
            primaryCmd = `environment.systemPackages = with pkgs; [\n${pkgList}\n];`;
        } else if (selectedDistro === 'snap') {
            // Snap needs separate commands for --classic packages
            if (packageNames.length === 1) {
                primaryCmd = `${distro.installPrefix} ${packageNames[0]}`;
            } else if (packageNames.length > 1) {
                // For multiple snap packages, we chain them with &&
                // Note: snap doesn't support installing multiple packages in one command like apt
                primaryCmd = packageNames.map(p => `sudo snap install ${p}`).join(' && ');
            }
        } else if (selectedDistro === 'arch' && aurPackageInfo.hasAur) {
            // Arch with AUR packages - this is where it gets fun
            if (!hasYayInstalled) {
                // User doesn't have current helper installed - prepend installation
                const helperName = selectedHelper; // yay or paru

                // Common setup: sudo pacman -S --needed git base-devel
                // Then clone, make, install
                const installHelperCmd = `sudo pacman -S --needed git base-devel && git clone https://aur.archlinux.org/${helperName}.git /tmp/${helperName} && cd /tmp/${helperName} && makepkg -si --noconfirm && cd - && rm -rf /tmp/${helperName}`;

                // Install packages using the helper
                const installCmd = `${helperName} -S --needed --noconfirm ${packageNames.join(' ')}`;

                primaryCmd = `${installHelperCmd} && ${installCmd}`;
            } else {
                // User has helper installed - use it for ALL packages
                primaryCmd = `${selectedHelper} -S --needed --noconfirm ${packageNames.join(' ')}`;
            }
        } else if (selectedDistro === 'homebrew') {
            // Handle Homebrew: separate formulae and casks into separate commands
            const formulae = packageNames.filter(p => !p.startsWith('--cask '));
            const casks = packageNames.filter(p => p.startsWith('--cask ')).map(p => p.replace('--cask ', ''));
            const parts: string[] = [];
            if (formulae.length > 0) {
                parts.push(`brew install ${formulae.join(' ')}`);
            }
            if (casks.length > 0) {
                parts.push(`brew install --cask ${casks.join(' ')}`);
            }
            primaryCmd = parts.join(' && ');
        } else {
            if (packageNames.length > 0) {
                primaryCmd = `${distro.installPrefix} ${packageNames.join(' ')}`;
            }
        }

        let finalCmd = primaryCmd;
        if (flatpakFallbackPkgs.length > 0) {
            const flatpakCmd = `flatpak install flathub -y ${flatpakFallbackPkgs.join(' ')}`;
            if (finalCmd) {
                finalCmd += ` && ${flatpakCmd}`;
            } else {
                finalCmd = flatpakCmd;
            }
        }

        return finalCmd || '# No packages selected';
    }, [selectedDistro, selectedApps, aurPackageInfo.hasAur, hasYayInstalled, selectedHelper, isFlatpakEnabled]);

    return {
        selectedDistro,
        selectedApps,
        setSelectedDistro,
        toggleApp,
        selectAll,
        clearAll,
        isAppAvailable,
        getPackageName,
        generatedCommand,
        selectedCount: selectedApps.size,
        availableCount,
        isFlatpakEnabled,
        toggleFlatpakEnabled,
        // Arch/AUR specific
        hasYayInstalled,
        setHasYayInstalled,
        selectedHelper,
        setSelectedHelper,
        hasAurPackages: aurPackageInfo.hasAur,
        aurPackageNames: aurPackageInfo.packages,
        aurAppNames: aurPackageInfo.appNames,
        // Nix unfree specific
        hasUnfreePackages: unfreePackageInfo.hasUnfree,
        unfreeAppNames: unfreePackageInfo.appNames,
        // Hydration state
        isHydrated: hydrated,
    };
}

