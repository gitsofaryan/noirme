'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import SpeederLoader from '@/components/SpeederLoader';

const LoadingContext = createContext<boolean>(true);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Keep navbar hidden while map is loading (3.5 seconds to account for minLoadingTimePassed + animations)
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 3500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <LoadingContext.Provider value={isLoading}>
            {isLoading && <SpeederLoader />}
            {children}
        </LoadingContext.Provider>
    );
}

export function useIsLoading() {
    return useContext(LoadingContext);
}
