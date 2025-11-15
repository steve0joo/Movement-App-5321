import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllUsers,
  getUsersByTeam,
  deleteUserProfile,
  updateUserProfile
} from '../../services/userService';
import { getAllTeams } from '../../services/teamService';
import { getRoutesByTeam, assignRouteLeader } from '../../services/routeService';
import '../../pages/AdminStyles.css';
import editIcon from '../../assets/edit-button.png';
import trashIcon from '../../assets/trash-button.png';

export default function UserManagementTab() {
  const { role, teamId: userTeamId } = useAuth();

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
        // team_admin - only show users in their team
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

  async function handleDeleteUser() {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      setError('');
      await deleteUserProfile(deleteConfirm.id);
      setUsers(users.filter((user) => user.id !== deleteConfirm.id));
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

  async function openEditModal(user) {
    setEditingUser(user);
    setEditDisplayName(user.displayName || '');
    setEditRole(user.role || 'volunteer');
    setEditTeamId(user.teamId || '');
    setEditRouteId(user.routeId || '');

    // Load routes for the user's team
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
    setEditRouteId(''); // Reset route when team changes

    // Load routes for new team
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
        routeId: editRouteId || null
      };

      // Update user profile
      await updateUserProfile(editingUser.id, updates);

      // If route changed, also update the route's routeLeaderId (bidirectional sync)
      if (editRouteId && editRouteId !== editingUser.routeId) {
        await assignRouteLeader(editRouteId, editingUser.id);
      } else if (!editRouteId && editingUser.routeId) {
        // If route was removed, unassign this user from their old route
        await assignRouteLeader(editingUser.routeId, null);
      }

      setSuccess(`User ${editingUser.email} updated successfully!`);
      setEditingUser(null);
      await loadUsers(); // Reload users to show updated data

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  function getTeamName(teamId) {
    if (!teamId) return 'Unassigned';
    const team = teams.find(t => t.id === teamId);
    return team?.name || teamId.substring(0, 8) + '...';
  }

  const visibleUsers = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = (user.displayName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const role = (user.role || '').toLowerCase();
      const team = getTeamName(user.teamId).toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q) || team.includes(q);
    });
  }, [users, searchTerm, teams]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div>
        <h2>Users</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Search Bar */}
      <div className="search-row" >
        <input
          type="search"
          placeholder="Search by name, email, role, or team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          style={{ width: '100%' }}
        />
      </div>

      {/* Users Table */}
      {visibleUsers.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'No users match your search.' : 'No users found.'}</p>
        </div>
      ) : (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Display Name</th>
                <th>Role</th>
                <th>Team</th>
                <th>Route ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName || '-'}</td>
                  <td>
                    {/* <span className={`role-badge role-${user.role}`}> */}
                      {user.role}
                    {/* </span> */}
                  </td>
                  <td>{getTeamName(user.teamId)}</td>
                  <td style={{ fontSize: '12px'}}>
                    {user.routeId ? user.routeId: '-'} {/* .substring(0, 8) + '...' */}
                  </td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => openEditModal(user)}
                    >
                      <img src={editIcon} alt="Edit" />
                    </button>
                    {user.role !== 'super_admin' && (
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

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => !updating && setEditingUser(null)}>
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
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
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
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Route (Optional)</label>
                <select
                  value={editRouteId}
                  onChange={(e) => setEditRouteId(e.target.value)}
                  className="select-input"
                  disabled={!editTeamId || editRoutesForTeam.length === 0}
                >
                  <option value="">Unassigned</option>
                  {editRoutesForTeam.map(route => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
                {editTeamId && editRoutesForTeam.length === 0 && (
                  <small style={{ color: '#6B7280', display: 'block', marginTop: '4px' }}>
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
                <button type="submit" className="btn-confirm" disabled={updating}>
                  {updating ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteConfirm.email}</strong>?
              </p>
              <p className="warning-text">
                This will permanently delete the user's account and Firestore profile.
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
                className="btn-delete"
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
