import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getFollowUpsByTeam,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  getInvolvementsByTeam,
  createInvolvement,
  updateInvolvement,
  deleteInvolvement,
} from '../../services/communityInvolvementService';
import '../../pages/AdminStyles.css';
import editIcon from '../../assets/edit-button.png';
import trashIcon from '../../assets/trash-button.png';
import { getAllTeams } from '../../services/teamService';

export default function CommunityInvolvementTab() {
  const { currentUser, role, teamId: userTeamId } = useAuth();

  const [followUps, setFollowUps] = useState([]);
  const [involvements, setInvolvements] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [activeSection, setActiveSection] = useState('followUps'); // 'followUps' | 'involvements'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create modals
  const [showCreateFollowUpModal, setShowCreateFollowUpModal] = useState(false);
  const [showCreateInvolvementModal, setShowCreateInvolvementModal] = useState(false);
  const [newFollowUpName, setNewFollowUpName] = useState('');
  const [newInvolvementName, setNewInvolvementName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit modals
  const [showEditFollowUpModal, setShowEditFollowUpModal] = useState(false);
  const [showEditInvolvementModal, setShowEditInvolvementModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(null);
  const [editingInvolvement, setEditingInvolvement] = useState(null);
  const [editFollowUpName, setEditFollowUpName] = useState('');
  const [editInvolvementName, setEditInvolvementName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete modals
  const [showDeleteFollowUpModal, setShowDeleteFollowUpModal] = useState(false);
  const [showDeleteInvolvementModal, setShowDeleteInvolvementModal] = useState(false);
  const [deletingFollowUp, setDeletingFollowUp] = useState(null);
  const [deletingInvolvement, setDeletingInvolvement] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadData();
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
      setSelectedTeamId(userTeamId);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [followUpsList, involvementsList] = await Promise.all([
        getFollowUpsByTeam(selectedTeamId),
        getInvolvementsByTeam(selectedTeamId),
      ]);
      setFollowUps(followUpsList);
      setInvolvements(involvementsList);
      setError('');
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load options');
    } finally {
      setLoading(false);
    }
  }

  // Follow-Up handlers
  async function handleCreateFollowUp(e) {
    e.preventDefault();
    if (!newFollowUpName.trim()) {
      setError('Follow-up name is required');
      return;
    }
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    try {
      setCreating(true);
      setError('');
      await createFollowUp(newFollowUpName.trim(), selectedTeamId, currentUser.uid);
      setSuccess('Follow-up option created successfully!');
      setShowCreateFollowUpModal(false);
      setNewFollowUpName('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating follow-up:', err);
      setError('Failed to create follow-up: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditFollowUp(e) {
    e.preventDefault();
    if (!editFollowUpName.trim()) {
      setError('Follow-up name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await updateFollowUp(editingFollowUp.id, { name: editFollowUpName.trim() });
      setSuccess('Follow-up updated successfully!');
      setShowEditFollowUpModal(false);
      setEditingFollowUp(null);
      setEditFollowUpName('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating follow-up:', err);
      setError('Failed to update follow-up: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteFollowUp() {
    try {
      setDeleting(true);
      setError('');
      await deleteFollowUp(deletingFollowUp.id);
      setSuccess('Follow-up deleted successfully!');
      setShowDeleteFollowUpModal(false);
      setDeletingFollowUp(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting follow-up:', err);
      setError('Failed to delete follow-up: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Involvement handlers
  async function handleCreateInvolvement(e) {
    e.preventDefault();
    if (!newInvolvementName.trim()) {
      setError('Involvement name is required');
      return;
    }
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    try {
      setCreating(true);
      setError('');
      await createInvolvement(newInvolvementName.trim(), selectedTeamId, currentUser.uid);
      setSuccess('Involvement option created successfully!');
      setShowCreateInvolvementModal(false);
      setNewInvolvementName('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating involvement:', err);
      setError('Failed to create involvement: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditInvolvement(e) {
    e.preventDefault();
    if (!editInvolvementName.trim()) {
      setError('Involvement name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await updateInvolvement(editingInvolvement.id, { name: editInvolvementName.trim() });
      setSuccess('Involvement updated successfully!');
      setShowEditInvolvementModal(false);
      setEditingInvolvement(null);
      setEditInvolvementName('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating involvement:', err);
      setError('Failed to update involvement: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteInvolvement() {
    try {
      setDeleting(true);
      setError('');
      await deleteInvolvement(deletingInvolvement.id);
      setSuccess('Involvement deleted successfully!');
      setShowDeleteInvolvementModal(false);
      setDeletingInvolvement(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting involvement:', err);
      setError('Failed to delete involvement: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isSuperAdmin = role === 'super_admin';

  return (
    <div className="admin-page">
      <h2>Community Involvement</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Team selector */}
      {isSuperAdmin && (
        <div className="form-group">
          <label style={{ fontSize: '16px' }}>Team: </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', marginTop: '16px' }}>
        <button
          className={activeSection === 'followUps' ? 'btn-cancel' : 'btn-secondary'}
          onClick={() => setActiveSection('followUps')}
        >
          Follow-Up Options
        </button>
        <button
          className={activeSection === 'involvements' ? 'btn-cancel' : 'btn-secondary'}
          onClick={() => setActiveSection('involvements')}
        >
          Current Involvement Options
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading options...</div>
      ) : (
        <>
          {/* Follow-Ups Section */}
          {activeSection === 'followUps' && (
            <>
              <button
                className="btns-primary"
                onClick={() => setShowCreateFollowUpModal(true)}
                style={{ marginBottom: '16px' }}
              >
                Create Follow-Up Option
              </button>

              {followUps.length === 0 ? (
                <div className="empty-state">
                  <p>No follow-up options found for this team.</p>
                  <p>Create one to get started!</p>
                </div>
              ) : (
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
                      {followUps.map((followUp) => (
                        <tr key={followUp.id}>
                          <td>{followUp.name}</td>
                          <td>
                            {followUp.createdAt?.toDate
                              ? followUp.createdAt.toDate().toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td>
                            <button
                              className="btn-edit"
                              onClick={() => {
                                setEditingFollowUp(followUp);
                                setEditFollowUpName(followUp.name);
                                setShowEditFollowUpModal(true);
                              }}
                            >
                              <img src={editIcon} alt="Edit" />
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => {
                                setDeletingFollowUp(followUp);
                                setShowDeleteFollowUpModal(true);
                              }}
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
            </>
          )}

          {/* Involvements Section */}
          {activeSection === 'involvements' && (
            <>
              <button
                className="btns-primary"
                onClick={() => setShowCreateInvolvementModal(true)}
                style={{ marginBottom: '16px' }}
              >
                Create Involvement Option
              </button>

              {involvements.length === 0 ? (
                <div className="empty-state">
                  <p>No involvement options found for this team.</p>
                  <p>Create one to get started!</p>
                </div>
              ) : (
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
                      {involvements.map((involvement) => (
                        <tr key={involvement.id}>
                          <td>{involvement.name}</td>
                          <td>
                            {involvement.createdAt?.toDate
                              ? involvement.createdAt.toDate().toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td>
                            <button
                              className="btn-edit"
                              onClick={() => {
                                setEditingInvolvement(involvement);
                                setEditInvolvementName(involvement.name);
                                setShowEditInvolvementModal(true);
                              }}
                            >
                              <img src={editIcon} alt="Edit" />
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => {
                                setDeletingInvolvement(involvement);
                                setShowDeleteInvolvementModal(true);
                              }}
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
            </>
          )}
        </>
      )}

      {/* Create Follow-Up Modal */}
      {showCreateFollowUpModal && (
        <div className="modal-overlay" onClick={() => setShowCreateFollowUpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Follow-Up Option</h3>
            </div>
            <form onSubmit={handleCreateFollowUp}>
              <div className="form-group">
                <label>Option Name</label>
                <input
                  type="text"
                  value={newFollowUpName}
                  onChange={(e) => setNewFollowUpName(e.target.value)}
                  placeholder="e.g., not urgent, very urgent..."
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateFollowUpModal(false)}
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

      {/* Create Involvement Modal */}
      {showCreateInvolvementModal && (
        <div className="modal-overlay" onClick={() => setShowCreateInvolvementModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Involvement Option</h3>
            </div>
            <form onSubmit={handleCreateInvolvement}>
              <div className="form-group">
                <label>Option Name</label>
                <input
                  type="text"
                  value={newInvolvementName}
                  onChange={(e) => setNewInvolvementName(e.target.value)}
                  placeholder="e.g., Soccer Team, Youth Group..."
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateInvolvementModal(false)}
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

      {/* Edit Follow-Up Modal */}
      {showEditFollowUpModal && (
        <div className="modal-overlay" onClick={() => setShowEditFollowUpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Follow-Up Option</h3>
            </div>
            <form onSubmit={handleEditFollowUp}>
              <div className="form-group">
                <label>Option Name</label>
                <input
                  type="text"
                  value={editFollowUpName}
                  onChange={(e) => setEditFollowUpName(e.target.value)}
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditFollowUpModal(false)}
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

      {/* Edit Involvement Modal */}
      {showEditInvolvementModal && (
        <div className="modal-overlay" onClick={() => setShowEditInvolvementModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Involvement Option</h3>
            </div>
            <form onSubmit={handleEditInvolvement}>
              <div className="form-group">
                <label>Option Name</label>
                <input
                  type="text"
                  value={editInvolvementName}
                  onChange={(e) => setEditInvolvementName(e.target.value)}
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditInvolvementModal(false)}
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

      {/* Delete Follow-Up Modal */}
      {showDeleteFollowUpModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteFollowUpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Follow-Up Option</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deletingFollowUp?.name}</strong>?
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDeleteFollowUpModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-solid"
                onClick={handleDeleteFollowUp}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Involvement Modal */}
      {showDeleteInvolvementModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteInvolvementModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Involvement Option</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deletingInvolvement?.name}</strong>?
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDeleteInvolvementModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-solid"
                onClick={handleDeleteInvolvement}
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