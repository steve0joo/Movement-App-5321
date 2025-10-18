import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUserPage from './pages/AdminUserPage';
import FollowUps from './pages/FollowUps';
import FollowUpForm from './pages/FollowUpForm';

import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SyncProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminUserPage />
                </ProtectedRoute>
              }
            />
            <Route
            path="/followups"
            element={
              <ProtectedRoute>
                <FollowUps />
              </ProtectedRoute>
            }
          />
            <Route
              path="/followups/new"
              element={
                <ProtectedRoute>
                  <FollowUpForm />
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
