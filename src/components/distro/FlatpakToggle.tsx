import { Check } from 'lucide-react';
import { type DistroId } from '@/lib/data';
import { DistroIcon } from './DistroIcon';

export function FlatpakToggle({
    isFlatpakEnabled,
    onToggle,
    selectedDistro
}: {
    isFlatpakEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    selectedDistro: DistroId;
}) {
    if (['flatpak', 'homebrew', 'nix'].includes(selectedDistro)) {
        return null;
    }

    return (
        <button
            onClick={() => onToggle(!isFlatpakEnabled)}
            className={`
                group flex items-center gap-2 h-10 pl-3 pr-3
                rounded-md transition-all duration-150 border
                ${isFlatpakEnabled
                    ? 'bg-[#4A90D9]/10 border-[#4A90D9]/30 text-[#4A90D9]'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }
            `}
            aria-label="Enable Flatpak fallbacks"
            title="Enable Flatpak fallbacks for apps not in your distro's repository"
        >
            <div className={`
                flex items-center justify-center w-4 h-4 rounded-sm border
                transition-colors duration-150
                ${isFlatpakEnabled
                    ? 'bg-[#4A90D9] border-[#4A90D9]'
                    : 'bg-transparent border-[var(--border-primary)] group-hover:border-[var(--text-muted)]'
                }
            `}>
                {isFlatpakEnabled && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>

            <span className="text-[14px] font-medium hidden sm:inline-block">Flatpak</span>
            <div className="w-5 h-5 flex items-center justify-center">
                <DistroIcon url="https://simpleicons.org/icons/flatpak.svg" name="Flatpak" size={18} />
            </div>
        </button>
    );
}
