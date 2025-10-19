import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile } from '../services/userService';
import './AddLeaderPage.css';

export default function AddLeaderPage() {
  const { role, currentUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    siteId: '',
    adminPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const adminEmail = currentUser?.email;

  // Redirect if not admin
  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error when user types
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.email || !formData.password || !formData.adminPassword) {
      setError('Route Leader\'s email, password, and admin\'s password are required.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('New Route Leader password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      // First, verify admin password by attempting to re-authenticate
      await signInWithEmailAndPassword(auth, adminEmail, formData.adminPassword);

      // Create Firebase Auth account for new leader
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Create Firestore profile with 'leader' role
      await createUserProfile(userCredential.user.uid, {
        email: formData.email,
        role: 'leader',
        displayName: formData.displayName || null,
        siteId: formData.siteId || null,
      });

      // Sign out the newly created user
      await signOut(auth);

      // Re-authenticate the admin
      await signInWithEmailAndPassword(auth, adminEmail, formData.adminPassword);

      setSuccess(true);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        siteId: '',
        adminPassword: '',
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/admin/users');
      }, 2000);
    } catch (err) {
      console.error('Error creating route leader:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect admin password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Failed to create route leader. Please try again.');
      }

      // Try to re-authenticate admin if they got logged out
      try {
        if (!auth.currentUser && adminEmail && formData.adminPassword) {
          await signInWithEmailAndPassword(auth, adminEmail, formData.adminPassword);
        }
      } catch (reAuthErr) {
        console.error('Re-authentication failed:', reAuthErr);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="add-leader-page">
      <header className="add-leader-header">
        <button onClick={() => navigate('/admin/users')} className="btn-back">
          ← Back to Manage Route Leaders
        </button>
        <h1>Add New Route Leader</h1>
      </header>

      <div className="add-leader-content">
        {success && (
          <div className="success-message">
            ✓ Route leader created successfully! Redirecting...
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="add-leader-form">
          <div className="form-section">
            <h2>Account Information</h2>

            <div className="form-group">
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="leader@example.com"
                required
                autoComplete="username"
              />
              <small>This will be used for login</small>
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Profile Information</h2>

            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="John Doe"
                maxLength={100}
              />
              <small>Optional - Friendly name to display in the app</small>
            </div>

            <div className="form-group">
              <label htmlFor="siteId">Site ID</label>
              <input
                type="text"
                id="siteId"
                name="siteId"
                value={formData.siteId}
                onChange={handleChange}
                placeholder="e.g., Site-001, NYC, Tokyo"
                maxLength={50}
              />
              <small>
                Optional - Identifies which global site this leader manages
              </small>
            </div>
          </div>

          <div className="form-section">
            <h2>Admin Verification</h2>

            <div className="form-group">
              <label htmlFor="adminPassword">
                Your Admin Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="adminPassword"
                name="adminPassword"
                value={formData.adminPassword}
                onChange={handleChange}
                placeholder="Enter your admin password"
                required
                autoComplete="current-password"
              />
              <small>
                Required to verify your identity before creating a new user
              </small>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || success}
            >
              {loading ? 'Creating...' : 'Create Route Leader'}
            </button>
          </div>
        </form>

        <div className="info-box">
          <h3>About Route Leaders</h3>
          <ul>
            <li>
              Route leaders can manage volunteers and data for their assigned
              site
            </li>
            <li>
              Route leaders have elevated permissions compared to regular
              volunteers
            </li>
            <li>
              Route leaders can create, edit, and delete neighborhood records
            </li>
            <li>
              <strong>Security Note:</strong> Your admin password is required to
              verify your identity before creating new users
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
