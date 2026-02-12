'use client';

import { useCallback } from 'react';
import type { DistroId } from '@/lib/data';
import {
    isFlathubVerified,
    isSnapVerified,
} from '@/lib/verification';

export interface UseVerificationResult {
    // Kept for compatibility, always false now
    isLoading: boolean;
    hasError: boolean;
    isVerified: (distro: DistroId, packageName: string) => boolean;
    getVerificationSource: (distro: DistroId, packageName: string) => 'flathub' | 'snap' | null;
}

// Now purely synchronous using build-time generated data
export function useVerification(): UseVerificationResult {
    // Check if package is verified for the distro
    const isVerified = useCallback((distro: DistroId, packageName: string): boolean => {
        if (distro === 'flatpak') {
            return isFlathubVerified(packageName);
        }
        if (distro === 'snap') {
            return isSnapVerified(packageName);
        }
        return false;
    }, []);

    // Get verification source for badge styling
    const getVerificationSource = useCallback((distro: DistroId, packageName: string): 'flathub' | 'snap' | null => {
        if (distro === 'flatpak' && isFlathubVerified(packageName)) {
            return 'flathub';
        }
        if (distro === 'snap' && isSnapVerified(packageName)) {
            return 'snap';
        }
        return null;
    }, []);

    return {
        isLoading: false,
        hasError: false,
        isVerified,
        getVerificationSource,
    };
}

