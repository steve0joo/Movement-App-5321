import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getCommunitiesByTeam,
  createCommunity,
  updateCommunity,
  deleteCommunity
} from '../../services/communityService';
import '../../pages/AdminStyles.css';
import editIcon from '../../assets/edit-button.png';
import trashIcon from '../../assets/trash-button.png';
import { getAllTeams } from '../../services/teamService';

export default function CommunityManagementTab() {
  const { currentUser, role, teamId: userTeamId } = useAuth();

  const [communities, setCommunities] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create community modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit community modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [editCommunityName, setEditCommunityName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCommunity, setDeletingCommunity] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadCommunities();
    }
  }, [selectedTeamId]);

  async function loadTeams() {
    if (role === 'super_admin') {
      try {
        const allTeams = await getAllTeams();
        setTeams(allTeams);
        if (!selectedTeamId && allTeams.length > 0) {
          setSelectedTeamId(allTeams[0].id);
        }
      } catch (err) {
        console.error('Error loading teams:', err);
        setError('Failed to load teams');
      }
    } else {
      // team_admin - locked to their team
      setSelectedTeamId(userTeamId);
    }
  }

  async function loadCommunities() {
    try {
      setLoading(true);
      const communitiesList = await getCommunitiesByTeam(selectedTeamId);
      setCommunities(communitiesList);
      setError('');
    } catch (err) {
      console.error('Error loading communities:', err);
      setError('Failed to load communities');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCommunity(e) {
    e.preventDefault();

    if (!newCommunityName.trim()) {
      setError('Community name is required');
      return;
    }

    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    try {
      setCreating(true);
      setError('');

      await createCommunity(
        newCommunityName.trim(),
        selectedTeamId,
        currentUser.uid
      );

      setSuccess('Community created successfully!');
      setShowCreateModal(false);
      setNewCommunityName('');

      await loadCommunities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating community:', err);
      setError('Failed to create community: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditCommunity(e) {
    e.preventDefault();

    if (!editCommunityName.trim()) {
      setError('Community name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      await updateCommunity(editingCommunity.id, {
        name: editCommunityName.trim()
      });

      setSuccess('Community updated successfully!');
      setShowEditModal(false);
      setEditingCommunity(null);
      setEditCommunityName('');

      await loadCommunities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating community:', err);
      setError('Failed to update community: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteCommunity() {
    try {
      setDeleting(true);
      setError('');

      await deleteCommunity(deletingCommunity.id);

      setSuccess('Community deleted successfully!');
      setShowDeleteModal(false);
      setDeletingCommunity(null);

      await loadCommunities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting community:', err);
      setError('Failed to delete community: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openEditModal(community) {
    setEditingCommunity(community);
    setEditCommunityName(community.name);
    setShowEditModal(true);
  }

  function openDeleteModal(community) {
    setDeletingCommunity(community);
    setShowDeleteModal(true);
  }

  const isSuperAdmin = role === 'super_admin';

  return (
    <div className="admin-page">
        <h2>Communities</h2>
        <button className="btns-primary" onClick={() => setShowCreateModal(true)}>
        Create New Community
        </button>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Team selector for super_admin */}
      {isSuperAdmin && (
        // <div className="filters-panel">
          <div className='filter-row'>
          <label style={{fontSize: '18px'}}>Team: </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="sort-select"
            >
              <option value=""> Select a team </option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          
          </div>
        // </div>
      )}

      {loading ? (
        <div className="loading">Loading communities...</div>
      ) : communities.length === 0 ? (
        <div className="empty-state">
          <p>No communities found for this team.</p>
          <p>Create one to get started!</p>
        </div>
      ) : (
        // <div className="data-table-container">
        <div className="users-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {communities.map(community => (
                <tr key={community.id}>
                  <td>{community.name}</td>
                  <td>
                    {community.createdAt?.toDate
                      ? community.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => openEditModal(community)}
                    >
                      <img src={editIcon} alt="Edit" />
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => openDeleteModal(community)}
                    >
                      <img src={trashIcon} alt="Delete" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Community</h3>
            </div>
            <form onSubmit={handleCreateCommunity}>
              <div className="form-group">
                <label>Community Name</label>
                <input
                  type="text"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  placeholder="Enter community name..."
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-confirm" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Community Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Community</h3>
            </div>
            <form onSubmit={handleEditCommunity}>
              <div className="form-group">
                <label>Community Name</label>
                <input
                  type="text"
                  value={editCommunityName}
                  onChange={(e) => setEditCommunityName(e.target.value)}
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-confirm" disabled={updating}>
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Community</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deletingCommunity?.name}</strong>?
              </p>
              <p className="warning-text">
                This will soft delete the community (it will be hidden but data preserved).
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-delete"
                onClick={handleDeleteCommunity}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
