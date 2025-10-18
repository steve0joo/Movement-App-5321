import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isOfflineModeActive } from '../utils/offlineStorage';

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  const offlineMode = isOfflineModeActive();

  // Allow access if user is logged in OR in offline mode
  if (!currentUser && !offlineMode) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
