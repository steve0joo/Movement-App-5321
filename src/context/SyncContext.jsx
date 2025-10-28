import { createContext, useContext, useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../services/firebase';

const SyncContext = createContext();

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export function SyncProvider({ children }) {
  const isOnline = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline'
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  useEffect(() => {
    // Monitor Firestore sync status by listening to snapshot metadata
    // This detects when there are pending writes waiting to sync

    // Only monitor if user is authenticated (to avoid permission errors)
    // We monitor a collection that all authenticated users can read
    let unsubscribe = () => {};

    // Skip monitoring if offline to avoid errors
    if (!isOnline) {
      setSyncStatus('offline');
      return;
    }

    try {
      unsubscribe = onSnapshot(
        collection(db, 'teams'), // Monitor teams collection (all users can read their team)
        { includeMetadataChanges: true },
        (snapshot) => {
          // Check if there are pending writes
          const pending = snapshot.metadata.hasPendingWrites;
          setHasPendingWrites(pending);

          // Update sync status based on network and pending writes
          if (!isOnline) {
            setSyncStatus('offline');
          } else if (pending) {
            setSyncStatus('syncing');
          } else {
            setSyncStatus('synced');
          }
        },
        (error) => {
          // Handle permission errors gracefully
          if (error.code === 'permission-denied') {
            console.warn('Sync monitoring: No permission to read collection. User may not be logged in.');
            setSyncStatus('offline');
          } else {
            console.error('Sync monitoring error:', error);
          }
        }
      );
    } catch (error) {
      console.error('Failed to set up sync monitoring:', error);
      setSyncStatus('offline');
    }

    return () => unsubscribe();
  }, [isOnline]);

  // Update status when network changes
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline');
    } else if (hasPendingWrites) {
      setSyncStatus('syncing');
    } else {
      setSyncStatus('synced');
    }
  }, [isOnline, hasPendingWrites]);

  const value = {
    isOnline,
    syncStatus,
    hasPendingWrites,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}
