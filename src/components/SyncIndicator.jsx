import { useSync } from '../context/SyncContext';
import './SyncIndicator.css';

export default function SyncIndicator() {
  const { syncStatus, isOnline } = useSync();

  const getStatusInfo = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: '✓',
          text: 'Synced',
          className: 'sync-indicator synced'
        };
      case 'syncing':
        return {
          icon: '↻',
          text: 'Syncing...',
          className: 'sync-indicator syncing'
        };
      case 'offline':
        return {
          icon: '⚠',
          text: 'Offline',
          className: 'sync-indicator offline'
        };
      default:
        return {
          icon: '•',
          text: 'Unknown',
          className: 'sync-indicator'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className={status.className} title={isOnline ? 'Connected to internet' : 'No internet connection'}>
      <span className="sync-icon">{status.icon}</span>
      <span className="sync-text">{status.text}</span>
    </div>
  );
}
