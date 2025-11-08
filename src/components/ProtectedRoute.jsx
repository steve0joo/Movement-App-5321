// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isOfflineModeActive } from '../utils/offlineStorage';

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const offlineMode = isOfflineModeActive();

  if (loading) return null; // or a spinner

  if (!currentUser && !offlineMode) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
