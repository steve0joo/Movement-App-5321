// src/components/admin/UserManagementTab.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllUsers,
  getUsersByTeam,
  deleteUserProfile,
  updateUserProfile,
} from '../../services/userService';
import { getAllTeams } from '../../services/teamService';
import {
  getRoutesByTeam,
  assignRouteLeader,
} from '../../services/routeService';

import '../../pages/AdminStyles.css';
import editIcon from '../../assets/edit-button.png';
import trashIcon from '../../assets/trash-button.png';

export default function UserManagementTab() {
  const { currentUser, role, teamId: userTeamId } = useAuth();

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editRouteId, setEditRouteId] = useState('');
  const [editRoutesForTeam, setEditRoutesForTeam] = useState([]);
  const [updating, setUpdating] = useState(false);

  const isSuperAdmin = role === 'super_admin';

  /* ---------- Permissions helpers ---------- */

  const canEditUser = (targetUser) => {
    if (isSuperAdmin) return true; // super_admin → can edit anyone
    if (targetUser.id === currentUser?.uid) return false; // cannot edit self
    if (targetUser.role === 'super_admin') return false; // cannot edit super_admins

    if (role === 'team_admin') {
      return targetUser.teamId === userTeamId;
    }

    return false;
  };

  const canDeleteUser = (targetUser) => {
    if (isSuperAdmin) {
      return targetUser.role !== 'super_admin'; // can delete anyone except other super_admins
    }

    // always can delete yourself
    if (targetUser.id === currentUser?.uid) return true;

    if (targetUser.role === 'super_admin') return false;

    const roleHierarchy = {
      volunteer: 0,
      route_leader: 1,
      team_admin: 2,
      super_admin: 3,
    };

    const currentRoleLevel = roleHierarchy[role] || 0;
    const targetRoleLevel = roleHierarchy[targetUser.role] || 0;

    if (targetRoleLevel >= currentRoleLevel) {
      // cannot delete users with higher or equal role (except self, handled above)
      return false;
    }

    if (role === 'team_admin') {
      return targetUser.teamId === userTeamId;
    }

    // route_leader / volunteer → only self (already handled)
    return false;
  };

  /* ---------- Data loading ---------- */

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  async function loadTeams() {
    try {
      const allTeams = await getAllTeams();
      setTeams(allTeams);
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  }

  async function loadUsers() {
    try {
      setLoading(true);
      setError('');

      let usersList;
      if (isSuperAdmin) {
        usersList = await getAllUsers();
      } else {
        usersList = await getUsersByTeam(userTeamId);
      }

      setUsers(usersList);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Delete ---------- */

  async function handleDeleteUser() {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      setError('');
      await deleteUserProfile(deleteConfirm.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      setSuccess(`User ${deleteConfirm.email} has been deleted.`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  /* ---------- Edit ---------- */

  async function openEditModal(user) {
    setEditingUser(user);
    setEditDisplayName(user.displayName || '');
    setEditRole(user.role || 'volunteer');
    setEditTeamId(user.teamId || '');
    setEditRouteId(user.routeId || '');

    if (user.teamId) {
      try {
        const teamRoutes = await getRoutesByTeam(user.teamId);
        setEditRoutesForTeam(teamRoutes);
      } catch (err) {
        console.error('Error loading routes:', err);
        setEditRoutesForTeam([]);
      }
    } else {
      setEditRoutesForTeam([]);
    }
  }

  async function handleEditTeamChange(newTeamId) {
    setEditTeamId(newTeamId);
    setEditRouteId('');

    if (newTeamId) {
      try {
        const teamRoutes = await getRoutesByTeam(newTeamId);
        setEditRoutesForTeam(teamRoutes);
      } catch (err) {
        console.error('Error loading routes:', err);
        setEditRoutesForTeam([]);
      }
    } else {
      setEditRoutesForTeam([]);
    }
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setUpdating(true);
      setError('');

      const updates = {
        displayName: editDisplayName.trim() || null,
        role: editRole,
        teamId: editTeamId || null,
        routeId: editRouteId || null,
      };

      await updateUserProfile(editingUser.id, updates);

      if (editRouteId && editRouteId !== editingUser.routeId) {
        await assignRouteLeader(editRouteId, editingUser.id);
      } else if (!editRouteId && editingUser.routeId) {
        await assignRouteLeader(editingUser.routeId, null);
      }

      setSuccess(`User ${editingUser.email} updated successfully!`);
      setEditingUser(null);
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  /* ---------- Helpers ---------- */

  function getTeamName(teamId) {
    if (!teamId) return 'Unassigned';
    const team = teams.find((t) => t.id === teamId);
    return team?.name || teamId.substring(0, 8) + '...';
  }

  // Separate unassigned and assigned users
  const { unassignedUsers, assignedUsers } = useMemo(() => {
    const unassigned = users.filter((u) => !u.teamId);
    const assigned = users.filter((u) => u.teamId);
    return { unassignedUsers: unassigned, assignedUsers: assigned };
  }, [users]);

  // Apply search filter to assigned users
  const visibleAssignedUsers = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return assignedUsers;
    return assignedUsers.filter((user) => {
      const name = (user.displayName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const r = (user.role || '').toLowerCase();
      const team = getTeamName(user.teamId).toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        r.includes(q) ||
        team.includes(q)
      );
    });
  }, [assignedUsers, searchTerm, teams]);

  // Apply search filter to unassigned users
  const visibleUnassignedUsers = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return unassignedUsers;
    return unassignedUsers.filter((user) => {
      const name = (user.displayName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const r = (user.role || '').toLowerCase();
      return name.includes(q) || email.includes(q) || r.includes(q);
    });
  }, [unassignedUsers, searchTerm]);

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="admin-tab-content">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      <div>
        <h2>Users</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Search Bar */}
      <div className="search-row">
        <input
          type="search"
          placeholder="Search by name, email, role, or team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          style={{ width: '100%' }}
        />
      </div>

      {/* Unassigned Users Section */}
      {visibleUnassignedUsers.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#92400E' }}>Unassigned Users</strong>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: '#92400E',
                }}
              >
                These users need a team assignment to access the application.
              </p>
            </div>
          </div>

          <div className="users-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th className="actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUnassignedUsers.map((user) => (
                  <tr key={user.id} style={{ backgroundColor: '#FFFBEB' }}>
                    <td>{user.email}</td>
                    <td>{user.displayName || '-'}</td>
                    <td>
                      <span className={`role-pill role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {user.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-edit"
                        onClick={() => openEditModal(user)}
                      >
                        <img src={editIcon} alt="Assign Teamit" />
                      </button>
                      {canDeleteUser(user) && (
                        <button
                          className="btn-delete"
                          onClick={() => setDeleteConfirm(user)}
                        >
                          <img src={trashIcon} alt="Delete" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assigned Users Table */}
      <div>
        <h3 style={{ marginBottom: '16px', color: '#374151' }}>
          Assigned Users{' '}
          {visibleAssignedUsers.length > 0 &&
            `(${visibleAssignedUsers.length})`}
        </h3>

        {visibleAssignedUsers.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchTerm
                ? 'No users match your search.'
                : 'No assigned users found.'}
            </p>
          </div>
        ) : (
          <div className="users-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Route ID</th>
                  <th>Status</th>
                  <th className="actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssignedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.displayName || '-'}</td>
                    <td>
                      <span className={`role-pill role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{getTeamName(user.teamId)}</td>
                    <td style={{ fontSize: '12px' }}>
                      {user.routeId ? user.routeId : '-'}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          user.isActive ? 'active' : 'inactive'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {canEditUser(user) && (
                        <button
                          className="btn-edit"
                          onClick={() => openEditModal(user)}
                        >
                          <img src={editIcon} alt="Edit" />
                        </button>
                      )}
                      {canDeleteUser(user) && (
                        <button
                          className="btn-delete"
                          onClick={() => setDeleteConfirm(user)}
                        >
                          <img src={trashIcon} alt="Delete" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="modal-overlay"
          onClick={() => !updating && setEditingUser(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User: {editingUser.displayName}</h3>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Enter display name..."
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="select-input"
                >
                  <option value="volunteer">Volunteer</option>
                  <option value="route_leader">Route Leader</option>
                  <option value="team_admin">Team Admin</option>
                  {isSuperAdmin && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Team</label>
                <select
                  value={editTeamId}
                  onChange={(e) => handleEditTeamChange(e.target.value)}
                  className="select-input"
                >
                  <option value="">Unassigned</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Route</label>
                <select
                  value={editRouteId}
                  onChange={(e) => setEditRouteId(e.target.value)}
                  className="select-input"
                  disabled={!editTeamId || editRoutesForTeam.length === 0}
                >
                  <option value="">Unassigned</option>
                  {editRoutesForTeam.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
                {editTeamId && editRoutesForTeam.length === 0 && (
                  <small
                    style={{
                      color: '#6B7280',
                      display: 'block',
                      marginTop: '4px',
                    }}
                  >
                    No routes available in this team. Create routes first.
                  </small>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditingUser(null)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                <strong>{deleteConfirm.email}</strong>?
              </p>
              <p className="warning-text">
                This will permanently delete the user's account and Firestore
                profile.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-solid"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
