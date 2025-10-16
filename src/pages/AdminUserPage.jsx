import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllRouteLeaders, deleteUserProfile } from '../services/userService';
import './AdminUserPage.css';

export default function AdminUserPage() {
  const { currentUser, role } = useAuth();
  const navigate = useNavigate();
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Check if user is admin
  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
    }
  }, [role, navigate]);

  // Load route leaders
  useEffect(() => {
    loadRouteLeaders();
  }, []);

  async function loadRouteLeaders() {
    try {
      setLoading(true);
      setError('');
      const leaders = await getAllRouteLeaders();
      setRouteLeaders(leaders);
    } catch (err) {
      console.error('Error loading route leaders:', err);
      setError('Failed to load route leaders.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(userId, email) {
    try {
      setError('');
      await deleteUserProfile(userId);
      setRouteLeaders(routeLeaders.filter((leader) => leader.id !== userId));
      setDeleteConfirm(null);
      alert(`Route leader ${email} has been removed.`);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    }
  }

  function confirmDelete(leader) {
    setDeleteConfirm(leader);
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Loading route leaders...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button onClick={() => navigate('/')} className="btn-back">
          ← Back to Dashboard
        </button>
        <h1>Manage Route Leaders</h1>
        <div className="admin-info">
          <span className="admin-badge">Admin</span>
          <span>{currentUser?.email}</span>
        </div>
      </header>

      <div className="admin-content">
        {error && <div className="error-message">{error}</div>}

        <div className="admin-actions">
          <h2>Route Leaders ({routeLeaders.length})</h2>
          <button
            className="btn-primary"
            onClick={() => navigate('/admin/add-leader')}
          >
            Add Route Leader
          </button>
        </div>

        {routeLeaders.length === 0 ? (
          <div className="empty-state">
            <p>No route leaders found.</p>
          </div>
        ) : (
          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Site</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routeLeaders.map((leader) => (
                  <tr key={leader.id}>
                    <td>{leader.email}</td>
                    <td>{leader.displayName || '—'}</td>
                    <td>{leader.siteId || '—'}</td>
                    <td>
                      {leader.createdAt
                        ? new Date(
                            leader.createdAt.toDate()
                          ).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          leader.isActive ? 'active' : 'inactive'
                        }`}
                      >
                        {leader.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-delete"
                        onClick={() => confirmDelete(leader)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete route leader{' '}
              <strong>{deleteConfirm.email}</strong>?
            </p>
            <p className="warning">
              This action cannot be undone. The user will lose access to the
              system.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className="btn-delete"
                onClick={() =>
                  handleDeleteUser(deleteConfirm.id, deleteConfirm.email)
                }
              >
                Delete Route Leader
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
