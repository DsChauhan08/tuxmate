'use client';

import { memo } from 'react';
import type { DistroId } from '@/lib/data';

interface FlatpakToggleProps {
    enabled: boolean;
    onToggle: () => void;
    selectedDistro: DistroId;
}

const FLATPAK_DISTROS: DistroId[] = ['ubuntu', 'debian', 'arch', 'fedora', 'opensuse'];

function FlatpakToggleComponent({ enabled, onToggle, selectedDistro }: FlatpakToggleProps) {
    if (!FLATPAK_DISTROS.includes(selectedDistro)) return null;

    return (
        <button
            onClick={onToggle}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border transition-all duration-150"
            style={{
                borderColor: enabled ? '#4A90D9' : 'var(--border-primary)',
                backgroundColor: enabled ? 'color-mix(in srgb, #4A90D9, transparent 90%)' : 'transparent',
                color: enabled ? '#4A90D9' : 'var(--text-muted)',
            }}
            title="Include Flatpak packages for apps not available in your distro's repos"
        >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7.5 3.75v7.14L12 18.82l-7.5-3.75V7.93L12 4.18z" />
            </svg>
            <span className="whitespace-nowrap font-medium">
                {enabled ? 'Flatpak fallback on' : 'Flatpak fallback'}
            </span>
            <div
                className="w-7 h-4 rounded-full relative transition-colors duration-150"
                style={{ backgroundColor: enabled ? '#4A90D9' : 'var(--border-secondary)' }}
            >
                <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150"
                    style={{ transform: enabled ? 'translateX(14px)' : 'translateX(2px)' }}
                />
            </div>
        </button>
    );
}

export const FlatpakToggle = memo(FlatpakToggleComponent);
