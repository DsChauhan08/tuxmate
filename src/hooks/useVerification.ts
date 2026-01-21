'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DistroId } from '@/lib/data';
import {
    fetchFlathubVerifiedApps,
    isFlathubVerified,
    isSnapVerified,
} from '@/lib/verification';

export interface UseVerificationResult {
    /** Whether verification data is still loading */
    isLoading: boolean;
    /** Whether an error occurred during fetch */
    hasError: boolean;
    /** Check if an app is verified for the given distro */
    isVerified: (distro: DistroId, packageName: string) => boolean;
    /** Get the verification source type for styling */
    getVerificationType: (distro: DistroId, packageName: string) => 'flathub' | 'snap' | null;
}

/**
 * Hook to manage verification status for Flatpak and Snap packages.
 * Fetches Flathub verification data on mount and provides lookup functions.
 * Snap uses a static list of known verified packages (no API call needed).
 */
export function useVerification(): UseVerificationResult {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [flathubLoaded, setFlathubLoaded] = useState(false);
    const [snapLoaded, setSnapLoaded] = useState(false);

    // Track if we've already fetched to avoid duplicate requests
    const fetchedRef = useRef(false);

    // Fetch verification data on mount
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchVerificationData = async () => {
            try {
                // Fetch Flathub verified apps (bulk API call)
                await fetchFlathubVerifiedApps();
                setFlathubLoaded(true);

                // Snap uses static list (API doesn't support CORS from browsers)
                // No API call needed - data is immediately available
                setSnapLoaded(true);
            } catch (error) {
                console.error('Error fetching verification data:', error);
                setHasError(true);
                // Even on error, mark snap as loaded since it uses static data
                setSnapLoaded(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVerificationData();
    }, []);

    // Check if an app is verified for the given distro
    const isVerified = useCallback((distro: DistroId, packageName: string): boolean => {
        if (distro === 'flatpak' && flathubLoaded) {
            return isFlathubVerified(packageName);
        }
        if (distro === 'snap' && snapLoaded) {
            return isSnapVerified(packageName);
        }
        return false;
    }, [flathubLoaded, snapLoaded]);

    // Get the verification source type
    const getVerificationType = useCallback((distro: DistroId, packageName: string): 'flathub' | 'snap' | null => {
        if (distro === 'flatpak' && flathubLoaded && isFlathubVerified(packageName)) {
            return 'flathub';
        }
        if (distro === 'snap' && snapLoaded && isSnapVerified(packageName)) {
            return 'snap';
        }
        return null;
    }, [flathubLoaded, snapLoaded]);

    return {
        isLoading,
        hasError,
        isVerified,
        getVerificationType,
    };
}
