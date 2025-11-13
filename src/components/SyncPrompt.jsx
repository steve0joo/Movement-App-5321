import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  isOfflineModeActive,
  getOfflineItemsCount,
  exitOfflineMode,
} from '../utils/offlineStorage';
import {
  syncAndClearOfflineData,
  getOfflineDataSummary,
} from '../services/syncService';
import './SyncPrompt.css';

export default function SyncPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [offlineDataSummary, setOfflineDataSummary] = useState(null);

  const { currentUser } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // Check if it should show the sync prompt
  useEffect(() => {
    if (isOnline && isOfflineModeActive()) {
      const counts = getOfflineItemsCount();
      if (counts.total > 0) {
        setOfflineDataSummary(getOfflineDataSummary());
        setShowPrompt(true);
      }
    }
  }, [isOnline]);

  const handleSync = async () => {
    if (!currentUser) {
      // User needs to log in first
      setSyncResult({
        success: false,
        needsLogin: true,
        message: 'Please log in to sync your offline data to the database',
      });
      return;
    }

    try {
      setSyncing(true);
      const result = await syncAndClearOfflineData(currentUser.uid);
      setSyncResult(result);

      if (result.success) {
        // Wait a moment to show success message, then close
        setTimeout(() => {
          setShowPrompt(false);
          exitOfflineMode();
        }, 3000);
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: 'Failed to sync: ' + error.message,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleLater = () => {
    setShowPrompt(false);
    // Keep offline mode active and data intact
  };

  const handleLogin = () => {
    setShowPrompt(false);
    navigate('/login');
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="sync-prompt-overlay">
      <div className="sync-prompt-modal">
        <div className="sync-prompt-header">
          <h2>🌐 You're Back Online!</h2>
        </div>

        <div className="sync-prompt-body">
          {!syncResult ? (
            <>
              <p className="sync-prompt-message">
                You have{' '}
                <strong>{offlineDataSummary?.counts.total} items</strong> saved
                offline:
              </p>
              <ul className="sync-data-list">
                {offlineDataSummary?.counts.neighborhoods > 0 && (
                  <li>
                    🏘️ {offlineDataSummary.counts.neighborhoods} Neighborhoods
                  </li>
                )}
                {offlineDataSummary?.counts.visits > 0 && (
                  <li>👥 {offlineDataSummary.counts.visits} Visits</li>
                )}
              </ul>
              <p className="sync-prompt-question">
                {currentUser
                  ? 'Would you like to sync this data to the database now?'
                  : 'To sync this data to the database, you need to log in first.'}
              </p>
            </>
          ) : syncResult.needsLogin ? (
            <>
              <div className="sync-result sync-needs-login">
                <p>🔐 {syncResult.message}</p>
              </div>
            </>
          ) : syncResult.success ? (
            <>
              <div className="sync-result sync-success">
                <p>✅ {syncResult.message}</p>
                <p className="sync-detail">
                  Your offline data is now saved to the database!
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="sync-result sync-error">
                <p>❌ {syncResult.message}</p>
                {syncResult.results && (
                  <p className="sync-detail">
                    Synced: {syncResult.results.totalSuccessful} | Failed:{' '}
                    {syncResult.results.totalFailed}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="sync-prompt-actions">
          {!syncResult ? (
            <>
              {currentUser ? (
                <>
                  <button
                    className="btn-sync"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? '⏳ Syncing...' : '✓ Sync Now'}
                  </button>
                  <button
                    className="btn-later"
                    onClick={handleLater}
                    disabled={syncing}
                  >
                    Later
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-sync" onClick={handleLogin}>
                    Log In to Sync
                  </button>
                  <button className="btn-later" onClick={handleLater}>
                    Keep Offline
                  </button>
                </>
              )}
            </>
          ) : syncResult.needsLogin ? (
            <>
              <button className="btn-sync" onClick={handleLogin}>
                Go to Login
              </button>
              <button className="btn-later" onClick={handleLater}>
                Cancel
              </button>
            </>
          ) : syncResult.success ? (
            <button className="btn-sync" onClick={() => setShowPrompt(false)}>
              Close
            </button>
          ) : (
            <>
              <button className="btn-sync" onClick={handleSync}>
                Retry
              </button>
              <button className="btn-later" onClick={handleLater}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
