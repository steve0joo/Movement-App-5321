import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { enableOfflineMode, setOfflineUser, getOfflineUser } from '../utils/offlineStorage';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';
import './Login.css';

export default function Login() {
  // views: "welcome" | "login" | "signup"
  const [view, setView] = useState('welcome');

  // email auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [role, setRole] = useState('volunteer');

  const { login, signup, signInWithGoogleReturningNew } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // status
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Google new-user role flow
  const [googleRole, setGoogleRole] = useState('volunteer');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newGoogleUser, setNewGoogleUser] = useState(null);
  const [googleSaveBusy, setGoogleSaveBusy] = useState(false);

  const offlineMode = !isOnline;
  useEffect(() => setError(''), [view]);

  /* ---------------- Email login ---------------- */
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
      if (offlineMode) {
        setError(
          'Offline login failed. Please connect to the internet or ensure you have logged in before while online.'
        );
      } else {
        setError('Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Email signup ---------------- */
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 6)
      return setError('Password must be at least 6 characters');
    if (offlineMode) return setError('You must be online to create an account');

    try {
      setLoading(true);
      // Create user without team assignment (teamId: null)
      // Admin will assign team later
      await signup(email, password, role, displayName, null);
      navigate('/');
    } catch (err) {
      console.error('Signup error:', err);
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Google sign-in ---------------- */
  async function handleGoogle() {
    if (googleBusy) return;
    setError('');
    setGoogleBusy(true);
    try {
      const { user, isNew, viaRedirect } = await signInWithGoogleReturningNew();
      if (viaRedirect) return; // iOS Safari redirect; handled by listener below
      if (!user) return;

      if (isNew) {
        setNewGoogleUser(user);
        setShowRoleModal(true);
      } else {
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          await createUserProfile(user.uid, { role: 'volunteer' });
        }
        navigate('/');
      }
    } catch (e) {
      const ignorable = new Set([
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
      ]);
      if (!ignorable.has(e?.code)) {
        console.error('Google sign-in error:', e);
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  // Finish redirect flow (iOS Safari, etc.)
  useEffect(() => {
    function onRedirect(e) {
      const { user, isNew } = e.detail || {};
      if (user && isNew) {
        setNewGoogleUser(user);
        setShowRoleModal(true);
      } else if (user) {
        navigate('/');
      }
    }
    window.addEventListener('oauth-redirect-finished', onRedirect);
    return () =>
      window.removeEventListener('oauth-redirect-finished', onRedirect);
  }, [navigate]);

  // Save role for a brand-new Google user
  async function confirmGoogleRole() {
    if (!newGoogleUser || googleSaveBusy) return;
    setGoogleSaveBusy(true);
    setError('');
    try {
      await createUserProfile(newGoogleUser.uid, {
        role: googleRole,
        displayName: newGoogleUser.displayName || null,
      });
      setShowRoleModal(false);
      setNewGoogleUser(null);
      navigate('/');
    } catch (e) {
      const msg =
        e?.code === 'permission-denied' ||
        /insufficient permissions/i.test(String(e?.message))
          ? 'Could not save your role due to security rules. Try again, or contact an admin.'
          : e?.message || 'Could not save role. Please try again.';
      setError(msg);
      console.error('confirmGoogleRole error:', e);
    } finally {
      setGoogleSaveBusy(false);
    }
  }

  /* ---------------- Offline flow ---------------- */
  async function handleContinueOffline() {
    setError('');
    setLoading(true);

    console.log('🔍 [OFFLINE] Starting offline mode check...');

    try {
      // Step 1: Check localStorage
      console.log('🔍 [STEP 1] Checking localStorage...');
      const existingOfflineUser = getOfflineUser();

      if (existingOfflineUser) {
        if (existingOfflineUser.uid) {
          console.log('✅ [STEP 1] Valid cached data found - resuming offline mode');
          enableOfflineMode();
          navigate('/');
          return;
        } else {
          console.log('⚠️ [STEP 1] Legacy format detected - upgrading...');
        }
      } else {
        console.log('⚠️ [STEP 1] No localStorage data found');
      }

      // Step 2: Check Firebase Auth
      console.log('🔍 [STEP 2] Checking Firebase Auth cache...');
      const cachedUser = auth.currentUser;
      console.log('🔍 [STEP 2] Firebase Auth:', cachedUser ? 'Session found' : 'No session');

      if (cachedUser) {
        console.log('✅ [STEP 2] Loading profile from cache...');

        try {
          const cachedProfile = await getUserProfile(cachedUser.uid);

          if (cachedProfile) {
            const offlineUser = {
              uid: cachedUser.uid,
              displayName: cachedProfile.displayName || cachedUser.displayName || 'Offline User',
              email: cachedProfile.email || cachedUser.email || null,
              role: cachedProfile.role || 'volunteer',
              teamId: cachedProfile.teamId || null,
              routeId: cachedProfile.routeId || null,
            };

            console.log('✅ [STEP 2] Profile loaded - enabling offline mode');
            setOfflineUser(offlineUser);
            enableOfflineMode();
            navigate('/');
            return;
          } else {
            console.warn('⚠️ [STEP 2] Profile not found in cache');
            setError('Profile not cached. Please connect online once.');
            return;
          }
        } catch (profileError) {
          console.error('❌ [STEP 2] Profile load error:', profileError.message);

          const offlineUser = {
            uid: cachedUser.uid,
            displayName: cachedUser.displayName || 'Offline User',
            email: cachedUser.email || null,
            role: 'volunteer',
            teamId: null,
            routeId: null,
          };

          console.log('⚠️ [STEP 2] Enabling limited offline access');
          setOfflineUser(offlineUser);
          enableOfflineMode();
          navigate('/');
          return;
        }
      }

      // Step 3: Blocked
      console.log('❌ [STEP 3] No cached credentials - offline mode unavailable');
      setError(
        'You must log in online at least once before using offline mode.'
      );
    } catch (err) {
      console.error('❌ [ERROR]:', err);
      setError('Unable to enter offline mode.');
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Back button ---------------- */
  const BackButton = () =>
    view !== 'welcome' ? (
      <button
        className="back-link-fixed"
        type="button"
        aria-label="Back"
        onClick={() => setView('welcome')}
      >
        ←
      </button>
    ) : null;

  return (
    <div className="auth-screen">
      <BackButton />

      {/* ---------------- WELCOME ---------------- */}
      {view === 'welcome' && (
        <div className="auth-card welcome-card">
          <div className="logo-stack">
            <img
              src="/images/image-2.png"
              alt="Movement logo"
              className="logo-img"
            />
            <div className="app-name">THE MOVEMENT APP</div>
          </div>

          <div className="cta-stack">
            <button
              className="btn-pill btn-primary-mint"
              onClick={() => setView('login')}
            >
              Log in
            </button>
          </div>
        </div>
      )}

      {/* ---------------- LOGIN ---------------- */}
      {view === 'login' && (
        <div className="auth-card form-card">
          <div className="form-header">
            <img
              src="/images/image-2.png"
              alt="Movement logo"
              className="logo-img-sm"
            />
            <div className="app-name-sm">THE MOVEMENT APP</div>
          </div>

          {offlineMode && (
            <div className="offline-notice">
              ❌ You are offline. Login may work if you have logged in before,
              or you can continue in offline mode to record data locally.
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="form">
            <h2 className="sr-only">Log in</h2>

            <input
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              className="btn-pill btn-primary-mint"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <button
              type="button"
              className="link subtle"
              onClick={() => navigate('/reset-password')}
            >
              Forgot Password?
            </button>

            {error && <div className="error">{error}</div>}

            <div className="divider-row">
              <span>New?&nbsp;</span>
              <button
                type="button"
                className="link"
                onClick={() => setView('signup')}
              >
                Create an account
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn-pill btn-outline vendor"
              disabled={googleBusy}
              onClick={handleGoogle}
            >
              <img
                src="/images/google-logo.png"
                alt="Google logo"
                className="vendor-icon"
                style={{ width: '18px', height: '18px' }}
              />
              &nbsp; {googleBusy ? 'Connecting…' : 'Continue with Google'}
            </button>

            {offlineMode && (
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
          </form>
        </div>
      )}

      {/* ---------------- SIGNUP ---------------- */}
      {view === 'signup' && (
        <div className="auth-card form-card">
          <div className="form-header">
            <img
              src="/images/image-2.png"
              alt="Movement logo"
              className="logo-img-sm"
            />
            <div className="app-name-sm">THE MOVEMENT APP</div>
          </div>

          {offlineMode && (
            <div className="offline-notice">
              ❌ You are offline. Sign up requires internet connection.
            </div>
          )}

          <form onSubmit={handleSignup} className="form">
            <h2 className="sr-only">Create account</h2>

            <input
              className="input"
              type="text"
              placeholder="Full name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <input
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="role-select input"
              >
                <option value="volunteer">Volunteer</option>
                <option value="route_leader">Route Leader</option>
                <option value="team_admin">Administrator</option>
              </select>
              <small className="form-hint">
                {role === 'volunteer' &&
                  'Basic access to record and view data in the team'}
                {role === 'route_leader' && 'Manage a route and its volunteers'}
                {role === 'team_admin' && 'Full administrative access'}
              </small>
            </div>

            <div className="info-notice" style={{
              padding: '12px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#92400E'
            }}>
              Your account will be created without a team assignment. An administrator will assign you to a team to activate your access.
            </div>

            <button
              type="submit"
              className="btn-pill btn-primary-mint"
              disabled={loading || offlineMode}
            >
              {loading ? 'Signing up...' : 'Sign Up!'}
            </button>

            {error && <div className="error">{error}</div>}

            <div className="footer-inline">
              <span>Already have an account? </span>
              <button
                type="button"
                className="link"
                onClick={() => setView('login')}
              >
                Log In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role modal for brand-new Google users */}
      {showRoleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.25)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '92%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 16,
              padding: '18px 16px',
              boxShadow: '0 14px 36px rgba(0,0,0,.18)',
            }}
          >
            <div className="sheet-title" style={{ marginBottom: 8 }}>
              Choose your role
            </div>
            <div className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
              This is only asked the first time for Google accounts.
            </div>
            <select
              className="input"
              value={googleRole}
              onChange={(e) => setGoogleRole(e.target.value)}
            >
              <option value="volunteer">Volunteer</option>
              <option value="route_leader">Route Leader</option>
              <option value="team_admin">Administrator</option>
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn-pill btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  if (googleSaveBusy) return;
                  setShowRoleModal(false);
                  setNewGoogleUser(null);
                }}
                disabled={googleSaveBusy}
              >
                Cancel
              </button>
              <button
                className="btn-pill btn-primary-mint"
                style={{ flex: 1 }}
                onClick={confirmGoogleRole}
                disabled={googleSaveBusy}
              >
                {googleSaveBusy ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
