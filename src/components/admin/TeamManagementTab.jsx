import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTeams, createTeam, updateTeam, deleteTeam } from '../../services/teamService';
import { getUsersByTeam } from '../../services/userService';
import '../../pages/AdminStyles.css';
export default function TeamManagementTab() {
  const { currentUser } = useAuth();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create team modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCountry, setNewTeamCountry] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('');
  const [creating, setCreating] = useState(false);

  // Team users modal state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Edit team modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamCity, setEditTeamCity] = useState('');
  const [editTeamCountry, setEditTeamCountry] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      setLoading(true);
      const allTeams = await getAllTeams();
      setTeams(allTeams);
      setError('');
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();

    if (!newTeamName.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');

      await createTeam(newTeamName.trim(), currentUser.uid);

      setSuccess('Team created successfully!');
      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamCountry('');
      setNewTeamCity('');

      await loadTeams();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleViewTeamUsers(team) {
    setSelectedTeam(team);
    setLoadingUsers(true);

    try {
      const users = await getUsersByTeam(team.id);
      setTeamUsers(users);
    } catch (err) {
      console.error('Error loading team users:', err);
      setError('Failed to load team users');
    } finally {
      setLoadingUsers(false);
    }
  }

  function closeUsersModal() {
    setSelectedTeam(null);
    setTeamUsers([]);
  }

  function handleEditClick(team) {
    setEditingTeam(team);
    setEditTeamName(team.name || '');
    setEditTeamCity(team.city || '');
    setEditTeamCountry(team.country || '');
    setShowEditModal(true);
  }

  async function handleUpdateTeam(e) {
    e.preventDefault();

    if (!editTeamName.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      const updates = {
        name: editTeamName.trim(),
        city: editTeamCity.trim() || null,
        country: editTeamCountry.trim() || null,
      };

      await updateTeam(editingTeam.id, updates);

      setSuccess('Team updated successfully!');
      setShowEditModal(false);
      setEditingTeam(null);
      setEditTeamName('');
      setEditTeamCity('');
      setEditTeamCountry('');

      await loadTeams();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating team:', err);
      setError('Failed to update team: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  function handleDeleteClick(team) {
    setDeletingTeam(team);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (!deletingTeam) return;

    try {
      setDeleting(true);
      setError('');

      await deleteTeam(deletingTeam.id);

      setSuccess(`Team "${deletingTeam.name}" deleted successfully!`);
      setShowDeleteModal(false);
      setDeletingTeam(null);

      await loadTeams();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to delete team: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancelDelete() {
    setShowDeleteModal(false);
    setDeletingTeam(null);
  }

  return (
    <div className='admin-page'>
      <div>
        <h2>Teams</h2>
      </div>
      
      {error && (
        <div className="error-message" style={{ marginBottom: '15px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '15px',
          border: '1px solid #c3e6cb'
        }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btns-primary"
        >
        Create New Team
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading teams...
        </div>
      ) : teams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No teams found. Create your first team to get started.
        </div>
      ) : (
        <div className="user-list">
          {teams.map((team) => (
            <div key={team.id} className="user-item">
              <div>
                <div className="user-name">{team.name}</div>
                <div className="user-email">
                  {team.city && team.country
                    ? `${team.city}, ${team.country}`
                    : team.city || team.country || 'No location set'}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  ID: {team.id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleViewTeamUsers(team)}
                  className="btn-secondary"
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  View Users
                </button>
                <button
                  onClick={() => handleEditClick(team)}
                  className="btn-secondary"
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(team)}
                  className="btn-danger"
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Team</h2>
            <form onSubmit={handleCreateTeam}>
              <div className="form-group">
                <label>Team Name *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Gwinnett, GA"
                  required
                  disabled={creating}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>City (Optional)</label>
                <input
                  type="text"
                  value={newTeamCity}
                  onChange={(e) => setNewTeamCity(e.target.value)}
                  placeholder="e.g., Gwinnett"
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label>Country (Optional)</label>
                <input
                  type="text"
                  value={newTeamCountry}
                  onChange={(e) => setNewTeamCountry(e.target.value)}
                  placeholder="e.g., USA"
                  disabled={creating}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-cancel"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && editingTeam && (
        <div className="modal-overlay" onClick={() => !updating && setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Team</h2>
            <form onSubmit={handleUpdateTeam}>
              <div className="form-group">
                <label>Team Name *</label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  placeholder="e.g., Gwinnett, GA"
                  required
                  disabled={updating}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>City (Optional)</label>
                <input
                  type="text"
                  value={editTeamCity}
                  onChange={(e) => setEditTeamCity(e.target.value)}
                  placeholder="e.g., Gwinnett"
                  disabled={updating}
                />
              </div>

              <div className="form-group">
                <label>Country (Optional)</label>
                <input
                  type="text"
                  value={editTeamCountry}
                  onChange={(e) => setEditTeamCountry(e.target.value)}
                  placeholder="e.g., USA"
                  disabled={updating}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-cancel"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Users Modal */}
      {selectedTeam && (
        <div className="modal-overlay" onClick={closeUsersModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Users in {selectedTeam.name}</h2>

            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Loading users...
              </div>
            ) : teamUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No users in this team yet.
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                {teamUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {user.displayName || 'No name'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {user.email}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        Role: <span style={{ fontWeight: 500 }}>{user.role}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '12px', fontSize: '14px', color: '#666', textAlign: 'center', borderTop: '2px solid #e5e7eb' }}>
                  Total: {teamUsers.length} user{teamUsers.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={closeUsersModal} className="btn-cancel">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingTeam && (
        <div className="modal-overlay" onClick={() => !deleting && handleCancelDelete()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Confirm Delete</h2>
            <div style={{ marginBottom: '20px' }}>
              <p>Are you sure you want to delete this team?</p>
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                padding: '12px',
                marginTop: '15px'
              }}>
                <strong>{deletingTeam.name}</strong>
                {(deletingTeam.city || deletingTeam.country) && (
                  <div style={{ fontSize: '14px', marginTop: '4px', color: '#666' }}>
                    {deletingTeam.city && deletingTeam.country
                      ? `${deletingTeam.city}, ${deletingTeam.country}`
                      : deletingTeam.city || deletingTeam.country}
                  </div>
                )}
              </div>
              <p style={{ marginTop: '15px', color: '#dc3545', fontSize: '14px' }}>
                <strong>Warning:</strong> This action will soft delete the team.
                All associated data will be preserved but marked as inactive.
              </p>
            </div>

            <div className="modal-actions">
              <button
                onClick={handleCancelDelete}
                className="btn-cancel"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn-delete"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
