import { createContext, useContext, type ReactNode } from 'react';
import {
  useLocalDataResilience,
  type UseLocalDataResilienceResult,
} from '../../hooks/useLocalDataResilience';

const LocalDataResilienceContext = createContext<UseLocalDataResilienceResult | null>(null);

interface LocalDataResilienceProviderProps {
  children: ReactNode;
}

/** Single mount point so quota checks and auto-backup run once per session. */
export function LocalDataResilienceProvider({
  children,
}: LocalDataResilienceProviderProps): JSX.Element {
  const value = useLocalDataResilience();
  return (
    <LocalDataResilienceContext.Provider value={value}>
      {children}
    </LocalDataResilienceContext.Provider>
  );
}

export function useLocalDataResilienceContext(): UseLocalDataResilienceResult {
  const value = useContext(LocalDataResilienceContext);
  if (value === null) {
    throw new Error('useLocalDataResilienceContext must be used within LocalDataResilienceProvider');
  }
  return value;
}
