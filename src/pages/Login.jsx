import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { enableOfflineMode, setOfflineUser } from '../utils/offlineStorage';
import { getAllTeams } from '../services/teamService';
import { getRoutesByTeam } from '../services/routeService';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('volunteer');
  const [teamId, setTeamId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [teams, setTeams] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loginMethod, setLoginMethod] = useState('email'); // email or accessCode
  const [accessCode, setAccessCode] = useState('');
  const { login, signup } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // Monitor offline status
  useEffect(() => {
    setOfflineMode(!isOnline);
  }, [isOnline]);

  // Load teams when in signup mode
  useEffect(() => {
    if (mode === 'signup' && isOnline) {
      loadTeams();
    }
  }, [mode, isOnline]);

  // Load routes when team changes
  useEffect(() => {
    if (teamId && role === 'route_leader') {
      loadRoutes(teamId);
    } else {
      setRoutes([]);
      setRouteId('');
    }
  }, [teamId, role]);

  async function loadTeams() {
    try {
      const allTeams = await getAllTeams();
      setTeams(allTeams);

      if (allTeams.length === 0) {
        console.warn('⚠️ No teams found in database. You may need to create teams first or run seed data.');
      }
    } catch (err) {
      console.error('❌ Error loading teams:', err);
      setError('Failed to load teams. Please check console for details.');
    }
  }

  async function loadRoutes(selectedTeamId) {
    try {
      const teamRoutes = await getRoutesByTeam(selectedTeamId);
      setRoutes(teamRoutes);
    } catch (err) {
      console.error('Error loading routes:', err);
      setRoutes([]);
    }
  }

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
        // Signup mode - validate team/route for certain roles
        if (role !== 'super_admin' && !teamId) {
          setLoading(false);
          return setError('Please select a team');
        }
        if (role === 'route_leader' && !routeId) {
          setLoading(false);
          return setError('Please select a route for route leader role');
        }
        await signup(email, password, role, displayName || null, teamId || null, routeId || null);
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

  const handleAccessCodeLogin = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError('Please enter your access code');
      return;
    }

    setLoading(true);
    setError('');

    //check if volunteer already has a firebase account from using his access code before
    try {
      const accessCodeDoc = doc(db, "users", accessCode.trim());
      
      let docSnap;
      try {
        docSnap = await getDoc(accessCodeDoc);
      } catch (firestoreError) {
        // code doesnt exist
        throw new Error('Access code does not exist. Please check your code and try again.');
      }
      
      // Check if we actually found a document with this access code
      if (!docSnap.exists()) {
        throw new Error('Access code does not exist. Please check your code and try again.');
      }
      
      const userData = docSnap.data();
      // Make sure this is actually a valid access code for a volunteer
      if (!userData.isAccessCodeUser || !userData.isActive || userData.role !== 'volunteer') {
        throw new Error('Invalid or inactive access code. Please contact your administrator.');
      }
      // Now need to create or sign into a Firebase Authentication account
      // using a predictable email/password format based on the access code
      const tempEmail = `volunteer_${accessCode}@temp.movement.app`;
      const tempPassword = `volunteer${accessCode}123`;
      
      let firebaseUser;
      

      try {
        // Try to sign in first. 
        const userCredential = await signInWithEmailAndPassword(auth, tempEmail, tempPassword);
        firebaseUser = userCredential.user;
        
      } catch (signInError) { // If signin failed, it's probably because this is the first time using this code
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          // Create a new Firebase Authentication account for this volunteer
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
            firebaseUser = userCredential.user;
          } catch (createError) {
            throw new Error('Authentication setup failed. Please try again or contact support.');
          }
        } else {
          // Some other kind of error happened. probably means wrong code
          throw new Error('Wrong access code. Please check your code and try again.');
        }
      }
      
      // Now create a proper user profile that our app's authentication system can find
      // This lets the volunteer stay logged in and access features
      const userProfileData = {
        email: tempEmail,
        role: "volunteer",
        displayName: `Volunteer ${accessCode}`,
        isActive: true,
        accessCode: accessCode,
        isAccessCodeUser: true,
        teamId: userData.teamId || "",
        createdAt: userData.createdAt || new Date(),
        updatedAt: new Date(),
      };
      
      // save user profile
      await setDoc(doc(db, "users", firebaseUser.uid), userProfileData);
      navigate('/');
    } catch (error) {
      console.error('Access code login error:', error);
      if (error.message.includes('Missing or insufficient permissions')) { // some error messages
        setError('Access code does not exist. Please check your code and try again.');
      } else {
        setError(error.message || 'Access code login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
        <p className="subtitle">Community Portal</p>

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

        {/* Only show mode tabs for email login method */}
        {loginMethod === 'email' && (
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
        )}

        {/* Login method selector */}
        <div className="login-method-selector" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('email');
              // Reset to login mode when switching to email
              setMode('login');
            }}
            className={`method-btn ${loginMethod === 'email' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              marginRight: '8px',
              border: loginMethod === 'email' ? '2px solid #4A8F8C' : '1px solid #ccc',
              backgroundColor: loginMethod === 'email' ? '#f0f9ff' : '#fff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Email Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('accessCode');
              // Force login mode when using access codes (no signup option)
              setMode('login');
            }}
            className={`method-btn ${loginMethod === 'accessCode' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              border: loginMethod === 'accessCode' ? '2px solid #4A8F8C' : '1px solid #ccc',
              backgroundColor: loginMethod === 'accessCode' ? '#f0f9ff' : '#fff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Access Code
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Email login form */}
        {loginMethod === 'email' && (
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
              <>
                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="role-select"
                  >
                    <option value="volunteer">Volunteer</option>
                    <option value="route_leader">Route Leader</option>
                    <option value="team_admin">Team Administrator</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                  <small className="form-hint">
                    {role === 'volunteer' && 'Basic access to manage data within team'}
                    {role === 'route_leader' && 'Manage routes and volunteers within team'}
                    {role === 'team_admin' && 'Full access within assigned team'}
                    {role === 'super_admin' && 'Full system access across all teams'}
                  </small>
                </div>

                {/* Team Selection (all roles except for super_admin) */}
                {role !== 'super_admin' && (
                  <div className="form-group">
                    <label htmlFor="teamId">Team *</label>
                    <select
                      id="teamId"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      required
                      disabled={teams.length === 0}
                    >
                      <option value="">
                        {teams.length === 0 ? 'No teams available - Create teams first' : 'Select a team...'}
                      </option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    {teams.length === 0 && isOnline && (
                      <small style={{ color: '#dc3545', display: 'block', marginTop: '5px' }}>
                        ⚠️ No teams found. Please create teams in the database first or use the seed data feature.
                      </small>
                    )}
                  </div>
                )}

                {/* Route Selection (route_leader only) */}
                {role === 'route_leader' && teamId && (
                  <div className="form-group">
                    <label htmlFor="routeId">Route *</label>
                    <select
                      id="routeId"
                      value={routeId}
                      onChange={(e) => setRouteId(e.target.value)}
                      required
                      disabled={routes.length === 0}
                    >
                      <option value="">
                        {routes.length === 0 ? 'No routes available' : 'Select a route...'}
                      </option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
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
        )}

        {/* Access code login form - LOGIN ONLY, NO SIGNUP */}
        {loginMethod === 'accessCode' && (
          <div>
            <h3 style={{ marginBottom: '16px', textAlign: 'center', color: '#333' }}>
              Enter Access Code
            </h3>
            <p style={{ marginBottom: '20px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
              Access codes are provided by your team administrator
            </p>
            <form onSubmit={handleAccessCodeLogin}>
              <div className="form-group">
                <label htmlFor="accessCode">Access Code</label>
                <input
                  type="text"
                  id="accessCode"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter your 5-digit access code"
                  maxLength="5"
                  pattern="[0-9]{5}"
                  style={{
                    fontSize: '18px',
                    letterSpacing: '2px',
                    textAlign: 'center'
                  }}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Verifying...' : 'Login with Access Code'}
              </button>
            </form>
          </div>
        )}

        {/* Offline mode button - only for login mode */}
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

        {/* Switch mode link - only show for email login */}
        {loginMethod === 'email' && (
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
        )}
      </div>
    </div>
  );
}
