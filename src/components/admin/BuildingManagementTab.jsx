import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTeams } from '../../services/teamService';
import { getCommunitiesByTeam } from '../../services/communityService';
import '../../pages/AdminStyles.css';
import { getBuildingsByCommunity, updateBuilding, deleteBuilding } from '../../services/buildingService';

export default function BuildingManagementTab() {
  const { role, teamId: userTeamId } = useAuth();

  // Permissions
  const isSuperAdmin = role === 'super_admin';
  const isTeamAdmin = role === 'team_admin';

  // Filter state
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  // Buildings state
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [editBuildingName, setEditBuildingName] = useState('');
  const [editBuildingAddress, setEditBuildingAddress] = useState('');
  const [editBuildingUnits, setEditBuildingUnits] = useState([]);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBuilding, setDeletingBuilding] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load teams on mount (for super_admin)
  useEffect(() => {
    if (isSuperAdmin) {
      loadTeams();
    }
  }, [isSuperAdmin]);

  // Load communities when team changes
  useEffect(() => {
    if (selectedTeamId) {
      loadCommunities(selectedTeamId);
    } else {
      setCommunities([]);
      setSelectedCommunityId('');
      setBuildings([]);
    }
  }, [selectedTeamId]);

  // Load buildings when community changes
  useEffect(() => {
    if (selectedCommunityId) {
      loadBuildings();
    } else {
      setBuildings([]);
    }
  }, [selectedCommunityId]);

  async function loadTeams() {
    try {
      const allTeams = await getAllTeams();
      setTeams(allTeams);
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('Failed to load teams');
    }
  }

  async function loadCommunities(teamId) {
    try {
      const teamCommunities = await getCommunitiesByTeam(teamId);
      setCommunities(teamCommunities);
    } catch (err) {
      console.error('Error loading communities:', err);
      setError('Failed to load communities');
    }
  }

  async function loadBuildings() {
    try {
      setLoading(true);
      setError('');

      // Get all buildings in the selected community
      const buildingsData = selectedCommunityId
        ? await getBuildingsByCommunity(selectedCommunityId)
        : [];

      setBuildings(buildingsData);
    } catch (err) {
      console.error('Error loading buildings:', err);
      setError('Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }

  function handleEditClick(building) {
    setEditingBuilding(building);
    setEditBuildingName(building.name || '');
    setEditBuildingAddress(building.address || '');
    setEditBuildingUnits(building.units || []);
    setNewUnitNumber('');
    setShowEditModal(true);
  }

  function handleAddUnit() {
    const trimmedUnit = newUnitNumber.trim();
    if (!trimmedUnit) {
      setError('Unit number cannot be empty');
      return;
    }
    if (editBuildingUnits.includes(trimmedUnit)) {
      setError('Unit number already exists');
      return;
    }
    setEditBuildingUnits([...editBuildingUnits, trimmedUnit]);
    setNewUnitNumber('');
    setError('');
  }

  function handleRemoveUnit(unitToRemove) {
    setEditBuildingUnits(editBuildingUnits.filter(unit => unit !== unitToRemove));
  }

  async function handleUpdateBuilding(e) {
    e.preventDefault();

    if (!editBuildingName.trim()) {
      setError('Building name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      const updates = {
        name: editBuildingName.trim(),
        address: editBuildingAddress.trim() || '',
        units: editBuildingUnits,
      };

      await updateBuilding(editingBuilding.id, updates);

      setSuccess('Building updated successfully!');
      setShowEditModal(false);
      setEditingBuilding(null);

      await loadBuildings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating building:', err);
      setError('Failed to update building: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  function handleDeleteClick(building) {
    setDeletingBuilding(building);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (!deletingBuilding) return;

    try {
      setDeleting(true);
      setError('');

      await deleteBuilding(deletingBuilding.id);

      setSuccess(`Building "${deletingBuilding.name}" deleted successfully!`);
      setShowDeleteModal(false);
      setDeletingBuilding(null);

      await loadBuildings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting building:', err);
      setError('Failed to delete building: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancelDelete() {
    setShowDeleteModal(false);
    setDeletingBuilding(null);
  }

  return (
    <div className="admin-page">
      <h2>Building Management</h2>
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

      {/* Filter Section */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Team Dropdown (super_admin only) */}
        {isSuperAdmin && (
          <div className="form-group">
            <label>Team</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              <option value="">Select a team...</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Community Dropdown */}
        {selectedTeamId && (
          <div className="form-group">
            <label>Community</label>
            <select
              value={selectedCommunityId}
              onChange={(e) => setSelectedCommunityId(e.target.value)}
              disabled={communities.length === 0}
            >
              <option value="">Select a community...</option>
              {communities.map(community => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Buildings List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading buildings...
        </div>
      ) : !selectedCommunityId ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Please select a community to view buildings.
        </div>
      ) : buildings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No buildings found in this community.
        </div>
      ) : (
        <div className="user-list">
          {buildings.map((building) => (
            <div key={building.id} className="user-item">
              <div>
                <div className="user-name">{building.name}</div>
                {building.address && (
                  <div className="user-email">{building.address}</div>
                )}
                <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                  Units: {building.units && building.units.length > 0 ? building.units.join(', ') : 'No units'}
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Visits: {building.visitCount || 0} | Last Visit: {building.lastVisitDate ? new Date(building.lastVisitDate.seconds * 1000).toLocaleDateString() : 'Never'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleEditClick(building)}
                  className="btn-secondary"
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Edit
                </button>
                {(isSuperAdmin || isTeamAdmin) && (
                  <button
                    onClick={() => handleDeleteClick(building)}
                    className="btn-danger"
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Building Modal */}
      {showEditModal && editingBuilding && (
        <div className="modal-overlay" onClick={() => !updating && setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Edit Building</h2>
            <form onSubmit={handleUpdateBuilding}>
              <div className="form-group">
                <label>Building Name *</label>
                <input
                  type="text"
                  value={editBuildingName}
                  onChange={(e) => setEditBuildingName(e.target.value)}
                  placeholder="e.g., Building A"
                  required
                  disabled={updating}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Address (Optional)</label>
                <input
                  type="text"
                  value={editBuildingAddress}
                  onChange={(e) => setEditBuildingAddress(e.target.value)}
                  placeholder="e.g., 123 Main St"
                  disabled={updating}
                />
              </div>

              <div className="form-group">
                <label>Units</label>
                <div style={{ marginBottom: '8px' }}>
                  {editBuildingUnits.length === 0 ? (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', color: '#666', fontSize: '14px' }}>
                      No units added yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {editBuildingUnits.map((unit, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            background: '#e0f2f1',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        >
                          <span>{unit}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUnit(unit)}
                            disabled={updating}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#dc3545',
                              cursor: 'pointer',
                              padding: '0 4px',
                              fontSize: '16px',
                              lineHeight: '1'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                    placeholder="Add unit number (e.g., 101)"
                    disabled={updating}
                    style={{ flex: 1 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddUnit}
                    className="btn-secondary"
                    disabled={updating}
                  >
                    Add Unit
                  </button>
                </div>
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
                  {updating ? 'Updating...' : 'Update Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingBuilding && (
        <div className="modal-overlay" onClick={() => !deleting && handleCancelDelete()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Confirm Delete</h2>
            <div style={{ marginBottom: '20px' }}>
              <p>Are you sure you want to delete this building?</p>
              <div style={{
                backgroundColor: '#E0F1E7',
                border: '1px solid #4A8F8C',
                borderRadius: '4px',
                padding: '12px',
                marginTop: '15px'
              }}>
                <strong>{deletingBuilding.name}</strong>
                {deletingBuilding.address && (
                  <div style={{ fontSize: '14px', marginTop: '4px', color: '#666' }}>
                    {deletingBuilding.address}
                  </div>
                )}
                {deletingBuilding.units && deletingBuilding.units.length > 0 && (
                  <div style={{ fontSize: '13px', marginTop: '6px', color: '#666' }}>
                    Units: {deletingBuilding.units.join(', ')}
                  </div>
                )}
                <div style={{ fontSize: '13px', marginTop: '6px', color: '#666' }}>
                  Total Visits: {deletingBuilding.visitCount || 0}
                </div>
              </div>
              <p style={{ marginTop: '15px', color: '#F28668', fontSize: '14px', fontWeight: 'bold' }}>
                <strong>⚠️ WARNING:</strong> This will PERMANENTLY delete the building and ALL {deletingBuilding.visitCount || 0} associated visit(s) from Firestore. This action cannot be undone!
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
                className="btn-danger-solid"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Building'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
