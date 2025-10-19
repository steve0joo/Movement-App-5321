import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllRouteLeaders, deleteUserProfile } from '../services/userService';
import editIcon from '../assets/edit-button.png';
import trashIcon from '../assets/trash-button.png';
import searchIcon from '../assets/search-button.png';
import logoHome from '../assets/logo-home-button.png';
import menuIcon from '../assets/menu-button.png'; // new import
import './AdminUserPage.css';

export default function AdminUserPage() {
  const { currentUser, role } = useAuth();
  const navigate = useNavigate();
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  function onSearchChange(e) {
    setSearchTerm(e.target.value);
  }

  // handle submit from the search bar (enter key or clicking the button)
  function handleSearchSubmit(e) {
    e.preventDefault();
    // currently filtering is live via searchTerm state; nothing else required.
    // placeholder for future analytics / explicit search trigger.
  }

  const visibleLeaders = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return routeLeaders;
    return routeLeaders.filter((l) => {
      const name = (l.displayName || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const site = (l.siteId || l.siteName || '').toLowerCase(); // support siteId or siteName if available
      return name.includes(q) || email.includes(q) || site.includes(q);
    });
  }, [routeLeaders, searchTerm]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function toggleMenu() {
    setMenuOpen((s) => !s);
  }

  function handleMenuSelect(item) {
    setMenuOpen(false);
    if (item === 'Dashboard') {
      navigate('/followups');
    }
    // other items intentionally left non-functional for now
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
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            onClick={toggleMenu}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            <img src={menuIcon} alt="Menu" />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-orientation="vertical">
              <button type="button" className="menu-item" onClick={() => handleMenuSelect('New Visit')} role="menuitem">
                New Visit
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect('Families')} role="menuitem">
                Families
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect('Dashboard')} role="menuitem">
                Dashboard
              </button>
            </div>
          )}
        </div>

        {/* logo button replaces header text */}
        <button
          className="logo-home"
          onClick={() => navigate('/')}
          title="Home"
          aria-label="Go to dashboard"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <img src={logoHome} alt="Home" style={{ height: 36, display: 'block' }} />
        </button>

        <div className="admin-info">
          <span className="admin-badge">Admin</span>
          <span>{currentUser?.email}</span>
        </div>
      </header>

      <div className="admin-content">
        {error && <div className="error-message">{error}</div>}

        <div
          className="admin-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <h2 style={{ margin: 0 }}>Route Leaders ({routeLeaders.length})</h2>

          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn-primary"
              onClick={() => navigate('/admin/add-leader')}
            >
              Add Route Leader
            </button>
          </div>
        </div>

        <form className="search-row" onSubmit={handleSearchSubmit} style={{ marginBottom: 16 }}>
          <input
            type="search"
            placeholder="Search by name, email, or site"
            value={searchTerm}
            onChange={onSearchChange}
            className="search-input"
            aria-label="Search route leaders by name, email, or site"
          />
          <button type="submit" className="search-button" aria-label="Search">
            <img src={searchIcon} alt="Search" style={{ width: 18, height: 18, display: 'block' }} />
          </button>
        </form>

        {visibleLeaders.length === 0 ? (
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
                {visibleLeaders.map((leader) => (
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
                        className="btn-edit"
                        onClick={() => { /* placeholder: implement edit action */ }}
                        title="Edit route leader"
                      >
                        <img
                          src={editIcon}
                          alt="Edit"
                        />
                      </button>

                      <button
                        className="btn-delete"
                        onClick={() => confirmDelete(leader)}
                        title="Delete route leader"
                        aria-label={`Delete ${leader.email}`}
                      >
                        <img
                          src={trashIcon}
                          alt="Delete"
                        />
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
