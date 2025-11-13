import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import ProtectedRoute from './components/ProtectedRoute';
import SyncPrompt from './components/SyncPrompt';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import UnifiedAdminPage from './pages/UnifiedAdminPage';
import AddLeaderPage from './pages/AddLeaderPage';
import SeedDataPage from './pages/SeedDataPage';
import FollowUps from './pages/FollowUps';
import VisitForm from './pages/VisitForm';
import PersonDetails from './pages/personDetails';
import VisitHistory from './pages/VisitHistory';
import AccessCodesPage from './pages/AccessCodesPage';
import './App.css';
function App() {
  return (
    <Router>
      <AuthProvider>
        <SyncProvider>
          <SyncPrompt />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* New Unified Admin Interface */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <UnifiedAdminPage />
                </ProtectedRoute>
              }
            />
            {/* Legacy routes - redirect to unified interface */}
            <Route
              path="/admin/users"
              element={<Navigate to="/admin#users" replace />}
            />
            <Route
              path="/admin/teams"
              element={<Navigate to="/admin#teams" replace />}
            />
            <Route
              path="/admin/buildings"
              element={<Navigate to="/admin#buildings" replace />}
            />
            {/* Keep these standalone admin pages */}
            <Route
              path="/admin/add-leader"
              element={
                <ProtectedRoute>
                  <AddLeaderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/seed-data"
              element={
                <ProtectedRoute>
                  <SeedDataPage />
                </ProtectedRoute>
              }
            />
            {/* Unified Visit History Page */}
            <Route
              path="/visit-history"
              element={
                <ProtectedRoute>
                  <VisitHistory />
                </ProtectedRoute>
              }
            />
            {/* Legacy routes - redirect to unified visit history */}
            <Route
              path="/followups"
              element={<Navigate to="/visit-history" replace />}
            />
            <Route
              path="/families"
              element={<Navigate to="/visit-history" replace />}
            />
            <Route
              path="/visits/new"
              element={
                <ProtectedRoute>
                  <VisitForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/access"
              element={
                <ProtectedRoute>
                  <AccessCodesPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SyncProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
