// src/context/SyncContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { onSnapshot, doc } from 'firebase/firestore';
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
    // Only start monitoring after we know who's signed in
    if (!currentUser) return;

    // Probe a doc the user is always allowed to read per your rules:
    // users/{uid}
    const probeRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      probeRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const pending = snapshot.metadata.hasPendingWrites;
        setHasPendingWrites(pending);

        if (!isOnline) {
          setSyncStatus('offline');
        } else if (pending) {
          setSyncStatus('syncing');
        } else {
          setSyncStatus('synced');
        }
      },
      (error) => {
        // If rules ever block this (shouldn't given your rules), don't crash the app.
        console.error('Sync monitoring error:', error);
        // Fall back to a conservative status
        setHasPendingWrites(false);
        setSyncStatus(isOnline ? 'synced' : 'offline');
      }
    );

    return () => unsubscribe();
  }, [currentUser, isOnline]);

  // Recompute when only network state changes (no Firestore event)
  useEffect(() => {
    if (!isOnline) setSyncStatus('offline');
    else if (hasPendingWrites) setSyncStatus('syncing');
    else setSyncStatus('synced');
  }, [isOnline, hasPendingWrites]);

  const value = { isOnline, syncStatus, hasPendingWrites };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
