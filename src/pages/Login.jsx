import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { enableOfflineMode, setOfflineUser } from '../utils/offlineStorage';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('volunteer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const { login, signup } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // Monitor offline status
  useEffect(() => {
    setOfflineMode(!isOnline);
  }, [isOnline]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validation
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        return setError('Passwords do not match');
      }
      if (password.length < 6) {
        return setError('Password must be at least 6 characters');
      }
      if (!isOnline) {
        return setError('You must be online to create an account');
      }
    }

    try {
      setLoading(true);

      if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else {
        // Signup mode
        await signup(email, password, role, displayName || null);
        navigate('/');
      }
    } catch (err) {
      console.error('Auth error:', err);

      // Handle offline login
      if (!isOnline && mode === 'login') {
        setError('Offline login failed. Please connect to the internet or ensure you have logged in before while online.');
      } else if (mode === 'login') {
        setError('Failed to log in. Please check your credentials.');
      } else {
        // Signup errors
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please log in instead.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Invalid email address.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Use at least 6 characters.');
        } else {
          setError('Failed to create account. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
  }

  function handleContinueOffline() {
    // Enable offline mode and navigate to dashboard
    const offlineUser = {
      displayName: displayName || 'Offline User',
      email: email || null,
      role: 'volunteer',
    };

    setOfflineUser(offlineUser);
    enableOfflineMode();
    navigate('/');
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Movement App</h1>
        <p className="subtitle">Route Leader Portal</p>

        {/* Offline indicator */}
        {offlineMode && mode === 'login' && (
          <div className="offline-notice">
            ❌ You are offline. Login may work if you have logged in before, or you can continue in offline mode to record data locally.
          </div>
        )}
        {offlineMode && mode === 'signup' && (
          <div className="offline-notice">
            ❌ You are offline. Sign up requires internet connection.
          </div>
        )}

        {/* Mode tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Log In
          </button>
          <button
            type="button"
            className={`tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Display Name (signup only) */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="displayName">Full Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
            />
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
              />
            </div>
          )}

          {/* Role Selection (signup only) */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="role-select"
              >
                <option value="volunteer">Volunteer</option>
                <option value="leader">Route Leader</option>
                <option value="admin">Administrator</option>
              </select>
              <small className="form-hint">
                {role === 'volunteer' && 'Basic access to manage data'}
                {role === 'leader' && 'Can manage data and volunteers'}
                {role === 'admin' && 'Full administrative access'}
              </small>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (mode === 'signup' && offlineMode)}
          >
            {loading
              ? (mode === 'login' ? 'Logging in...' : 'Creating account...')
              : (mode === 'login' ? 'Log In' : 'Create Account')
            }
          </button>
        </form>

        {/* Offline mode button */}
        {offlineMode && mode === 'login' && (
          <div className="offline-mode-section">
            <div className="divider">
              <span>OR</span>
            </div>
            <button
              type="button"
              className="btn-offline"
              onClick={handleContinueOffline}
            >
              📱 Continue Offline
            </button>
            <p className="offline-hint">
              Record data locally. Sync to database when you're back online.
            </p>
          </div>
        )}

        {/* Switch mode link */}
        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" onClick={switchMode} className="link-button">
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={switchMode} className="link-button">
                Log in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
