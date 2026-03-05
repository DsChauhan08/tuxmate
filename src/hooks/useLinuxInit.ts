'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { distros, apps, type DistroId } from '@/lib/data';
import { isAurPackage } from '@/lib/aur';
import { isUnfreePackage } from '@/lib/nixUnfree';

export { isAurPackage, AUR_PATTERNS, KNOWN_AUR_PACKAGES } from '@/lib/aur';

const FLATPAK_ELIGIBLE_DISTROS: DistroId[] = ['ubuntu', 'debian', 'arch', 'fedora', 'opensuse'];

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
    hasYayInstalled: boolean;
    setHasYayInstalled: (value: boolean) => void;
    selectedHelper: 'yay' | 'paru';
    setSelectedHelper: (helper: 'yay' | 'paru') => void;
    hasAurPackages: boolean;
    aurPackageNames: string[];
    aurAppNames: string[];
    hasUnfreePackages: boolean;
    unfreeAppNames: string[];
    isHydrated: boolean;
    isFlatpakEnabled: boolean;
    toggleFlatpakEnabled: () => void;
    isFlatpakFallback: (appId: string) => boolean;
}

const STORAGE_KEY_DISTRO = 'linuxinit_distro';
const STORAGE_KEY_APPS = 'linuxinit_apps';
const STORAGE_KEY_YAY = 'linuxinit_yay_installed';
const STORAGE_KEY_HELPER = 'linuxinit_selected_helper';
const STORAGE_KEY_FLATPAK = 'linuxinit_flatpak_enabled';

export function useLinuxInit(): UseLinuxInitReturn {
    const [selectedDistro, setSelectedDistroState] = useState<DistroId>('ubuntu');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [hasYayInstalled, setHasYayInstalled] = useState(false);
    const [selectedHelper, setSelectedHelper] = useState<'yay' | 'paru'>('yay');
    const [isFlatpakEnabled, setIsFlatpakEnabled] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const savedDistro = localStorage.getItem(STORAGE_KEY_DISTRO) as DistroId | null;
            const savedApps = localStorage.getItem(STORAGE_KEY_APPS);
            const savedYay = localStorage.getItem(STORAGE_KEY_YAY);
            const savedHelper = localStorage.getItem(STORAGE_KEY_HELPER) as 'yay' | 'paru' | null;

            if (savedDistro && distros.some(d => d.id === savedDistro)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedDistroState(savedDistro);
            }

            if (savedApps) {
                const appIds = JSON.parse(savedApps) as string[];
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

            const savedFlatpak = localStorage.getItem(STORAGE_KEY_FLATPAK);
            if (savedFlatpak === 'true') {
                setIsFlatpakEnabled(true);
            }
        } catch {
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY_DISTRO, selectedDistro);
            localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify([...selectedApps]));
            localStorage.setItem(STORAGE_KEY_YAY, hasYayInstalled.toString());
            localStorage.setItem(STORAGE_KEY_HELPER, selectedHelper);
            localStorage.setItem(STORAGE_KEY_FLATPAK, isFlatpakEnabled.toString());
        } catch {
        }
    }, [selectedDistro, selectedApps, hasYayInstalled, selectedHelper, isFlatpakEnabled, hydrated]);

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

    const flatpakActive = isFlatpakEnabled && FLATPAK_ELIGIBLE_DISTROS.includes(selectedDistro);

    const isFlatpakFallback = useCallback((appId: string): boolean => {
        if (!flatpakActive) return false;
        const app = apps.find(a => a.id === appId);
        if (!app) return false;
        const nativePkg = app.targets[selectedDistro];
        if (nativePkg !== undefined && nativePkg !== null) return false;
        return app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null;
    }, [flatpakActive, selectedDistro]);

    const isAppAvailable = useCallback((appId: string): boolean => {
        const app = apps.find(a => a.id === appId);
        if (!app) return false;
        const packageName = app.targets[selectedDistro];
        if (packageName !== undefined && packageName !== null) return true;
        if (flatpakActive) {
            return app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null;
        }
        return false;
    }, [selectedDistro, flatpakActive]);

    const getPackageName = useCallback((appId: string): string | null => {
        const app = apps.find(a => a.id === appId);
        if (!app) return null;
        return app.targets[selectedDistro] ?? null;
    }, [selectedDistro]);

    const setSelectedDistro = useCallback((distroId: DistroId) => {
        setSelectedDistroState(distroId);
        setSelectedApps(prevSelected => {
            const newSelected = new Set<string>();
            const flatpakOk = isFlatpakEnabled && FLATPAK_ELIGIBLE_DISTROS.includes(distroId);
            prevSelected.forEach(appId => {
                const app = apps.find(a => a.id === appId);
                if (app) {
                    const packageName = app.targets[distroId];
                    if (packageName !== undefined && packageName !== null) {
                        newSelected.add(appId);
                    } else if (flatpakOk && app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null) {
                        newSelected.add(appId);
                    }
                }
            });
            return newSelected;
        });
    }, [isFlatpakEnabled]);

    const toggleApp = useCallback((appId: string) => {
        const app = apps.find(a => a.id === appId);
        if (!app) return;
        const pkg = app.targets[selectedDistro];
        const hasFlatpakFallback = flatpakActive && app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null;
        if ((pkg === undefined || pkg === null) && !hasFlatpakFallback) return;

        setSelectedApps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(appId)) {
                newSet.delete(appId);
            } else {
                newSet.add(appId);
            }
            return newSet;
        });
    }, [selectedDistro, flatpakActive]);

    const selectAll = useCallback(() => {
        const allAvailable = apps
            .filter(app => {
                const pkg = app.targets[selectedDistro];
                if (pkg !== undefined && pkg !== null) return true;
                if (flatpakActive) {
                    return app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null;
                }
                return false;
            })
            .map(app => app.id);
        setSelectedApps(new Set(allAvailable));
    }, [selectedDistro, flatpakActive]);

    const clearAll = useCallback(() => {
        setSelectedApps(new Set());
    }, []);

    const availableCount = useMemo(() => {
        return apps.filter(app => {
            const pkg = app.targets[selectedDistro];
            if (pkg !== undefined && pkg !== null) return true;
            if (flatpakActive) {
                return app.targets['flatpak'] !== undefined && app.targets['flatpak'] !== null;
            }
            return false;
        }).length;
    }, [selectedDistro, flatpakActive]);

    const generatedCommand = useMemo(() => {
        if (selectedApps.size === 0) {
            return '# Select apps above to generate command';
        }

        const distro = distros.find(d => d.id === selectedDistro);
        if (!distro) return '';

        const nativePackages: string[] = [];
        const flatpakFallbackPackages: string[] = [];

        selectedApps.forEach(appId => {
            const app = apps.find(a => a.id === appId);
            if (app) {
                const pkg = app.targets[selectedDistro];
                if (pkg) {
                    nativePackages.push(pkg);
                } else if (flatpakActive && app.targets['flatpak']) {
                    flatpakFallbackPackages.push(app.targets['flatpak']);
                }
            }
        });

        if (nativePackages.length === 0 && flatpakFallbackPackages.length === 0) return '# No packages selected';

        let cmd = '';

        if (nativePackages.length > 0) {
            if (selectedDistro === 'nix') {
                const sortedPkgs = nativePackages.filter(p => p.trim()).sort();
                const pkgList = sortedPkgs.map(p => `    ${p}`).join('\n');
                cmd = `environment.systemPackages = with pkgs; [\n${pkgList}\n];`;
            } else if (selectedDistro === 'snap') {
                if (nativePackages.length === 1) {
                    cmd = `${distro.installPrefix} ${nativePackages[0]}`;
                } else {
                    cmd = nativePackages.map(p => `sudo snap install ${p}`).join(' && ');
                }
            } else if (selectedDistro === 'arch' && aurPackageInfo.hasAur) {
                if (!hasYayInstalled) {
                    const helperName = selectedHelper;
                    const installHelperCmd = `sudo pacman -S --needed git base-devel && git clone https://aur.archlinux.org/${helperName}.git /tmp/${helperName} && cd /tmp/${helperName} && makepkg -si --noconfirm && cd - && rm -rf /tmp/${helperName}`;
                    const installCmd = `${helperName} -S --needed --noconfirm ${nativePackages.join(' ')}`;
                    cmd = `${installHelperCmd} && ${installCmd}`;
                } else {
                    cmd = `${selectedHelper} -S --needed --noconfirm ${nativePackages.join(' ')}`;
                }
            } else if (selectedDistro === 'homebrew') {
                const formulae = nativePackages.filter(p => !p.startsWith('--cask '));
                const casks = nativePackages.filter(p => p.startsWith('--cask ')).map(p => p.replace('--cask ', ''));
                const parts: string[] = [];
                if (formulae.length > 0) parts.push(`brew install ${formulae.join(' ')}`);
                if (casks.length > 0) parts.push(`brew install --cask ${casks.join(' ')}`);
                cmd = parts.join(' && ') || '';
            } else {
                cmd = `${distro.installPrefix} ${nativePackages.join(' ')}`;
            }
        }

        if (flatpakFallbackPackages.length > 0) {
            const flatpakCmd = `flatpak install flathub -y ${flatpakFallbackPackages.join(' ')}`;
            cmd = cmd ? `${cmd} && ${flatpakCmd}` : flatpakCmd;
        }

        return cmd || '# No packages selected';
    }, [selectedDistro, selectedApps, aurPackageInfo.hasAur, hasYayInstalled, selectedHelper, flatpakActive]);

    const toggleFlatpakEnabled = useCallback(() => {
        setIsFlatpakEnabled(prev => !prev);
    }, []);

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
        hasYayInstalled,
        setHasYayInstalled,
        selectedHelper,
        setSelectedHelper,
        hasAurPackages: aurPackageInfo.hasAur,
        aurPackageNames: aurPackageInfo.packages,
        aurAppNames: aurPackageInfo.appNames,
        hasUnfreePackages: unfreePackageInfo.hasUnfree,
        unfreeAppNames: unfreePackageInfo.appNames,
        isHydrated: hydrated,
        isFlatpakEnabled,
        toggleFlatpakEnabled,
        isFlatpakFallback,
    };
}

