// src/context/SyncContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const SyncContext = createContext();

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}

export function SyncProvider({ children }) {
  const isOnline = useNetworkStatus();
  const { currentUser } = useAuth();

  // 'synced' | 'syncing' | 'offline'
  const [syncStatus, setSyncStatus] = useState('synced');
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  useEffect(() => {
    // If we're offline, show offline and don't open a listener.
    if (!isOnline) {
      setSyncStatus('offline');
      return;
    }

    // Require an authenticated user (per your Firestore rules).
    if (!currentUser) {
      setHasPendingWrites(false);
      setSyncStatus('synced');
      return;
    }

    // Always-readable doc under your rules: users/{uid}
    const probeRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      probeRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const pending = snapshot.metadata.hasPendingWrites;
        setHasPendingWrites(pending);

        if (!isOnline) setSyncStatus('offline');
        else if (pending) setSyncStatus('syncing');
        else setSyncStatus('synced');
      },
      (error) => {
        // Be resilient to rules hiccups or first-load races.
        console.error('Sync monitoring error:', error);
        setHasPendingWrites(false);
        setSyncStatus(isOnline ? 'synced' : 'offline');
      }
    );

    return () => unsubscribe();
  }, [currentUser, isOnline]);

  // If only the network flips, reflect it immediately.
  useEffect(() => {
    if (!isOnline) setSyncStatus('offline');
    else if (hasPendingWrites) setSyncStatus('syncing');
    else setSyncStatus('synced');
  }, [isOnline, hasPendingWrites]);

  const value = { isOnline, syncStatus, hasPendingWrites };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
