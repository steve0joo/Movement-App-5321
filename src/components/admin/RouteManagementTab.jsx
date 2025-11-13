import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getRoutesByCommunity,
  getRoutesByTeam,
  createRoute,
  updateRoute,
  deleteRoute,
  assignRouteLeader
} from '../../services/routeService';
import { getCommunitiesByTeam } from '../../services/communityService';
import { getAllTeams } from '../../services/teamService';
import { getUsersByTeam } from '../../services/userService';

export default function RouteManagementTab() {
  const { currentUser, role, teamId: userTeamId } = useAuth();

  const [routes, setRoutes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create route modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteCommunityId, setNewRouteCommunityId] = useState('');
  const [newRouteLeaderId, setNewRouteLeaderId] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit route modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [editRouteLeaderId, setEditRouteLeaderId] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadCommunities();
      loadRouteLeaders();
      loadRoutes();
    }
  }, [selectedTeamId, selectedCommunityId]);

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
      // team_admin or route_leader - locked to their team
      setSelectedTeamId(userTeamId);
    }
  }

  async function loadCommunities() {
    try {
      const communitiesList = await getCommunitiesByTeam(selectedTeamId);
      setCommunities(communitiesList);
    } catch (err) {
      console.error('Error loading communities:', err);
      setError('Failed to load communities');
    }
  }

  async function loadRouteLeaders() {
    try {
      const users = await getUsersByTeam(selectedTeamId);
      // Filter for route leaders and volunteers who can be assigned routes
      const leaders = users.filter(u =>
        u.role === 'route_leader' || u.role === 'volunteer'
      );
      setRouteLeaders(leaders);
    } catch (err) {
      console.error('Error loading route leaders:', err);
    }
  }

  async function loadRoutes() {
    try {
      setLoading(true);
      let routesList;

      if (selectedCommunityId) {
        routesList = await getRoutesByCommunity(selectedCommunityId);
      } else {
        routesList = await getRoutesByTeam(selectedTeamId);
      }

      setRoutes(routesList);
      setError('');
    } catch (err) {
      console.error('Error loading routes:', err);
      setError('Failed to load routes');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoute(e) {
    e.preventDefault();

    if (!newRouteName.trim()) {
      setError('Route name is required');
      return;
    }

    if (!newRouteCommunityId) {
      setError('Please select a community');
      return;
    }

    try {
      setCreating(true);
      setError('');

      await createRoute(
        newRouteName.trim(),
        newRouteCommunityId,
        selectedTeamId,
        currentUser.uid,
        newRouteLeaderId || null
      );

      setSuccess('Route created successfully!');
      setShowCreateModal(false);
      setNewRouteName('');
      setNewRouteCommunityId('');
      setNewRouteLeaderId('');

      await loadRoutes();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating route:', err);
      setError('Failed to create route: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditRoute(e) {
    e.preventDefault();

    if (!editRouteName.trim()) {
      setError('Route name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      // Update route name
      await updateRoute(editingRoute.id, {
        name: editRouteName.trim()
      });

      // Update route leader if changed
      if (editRouteLeaderId !== editingRoute.routeLeaderId) {
        await assignRouteLeader(editingRoute.id, editRouteLeaderId || null);
      }

      setSuccess('Route updated successfully!');
      setShowEditModal(false);
      setEditingRoute(null);
      setEditRouteName('');
      setEditRouteLeaderId('');

      await loadRoutes();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating route:', err);
      setError('Failed to update route: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteRoute() {
    try {
      setDeleting(true);
      setError('');

      await deleteRoute(deletingRoute.id);

      setSuccess('Route deleted successfully!');
      setShowDeleteModal(false);
      setDeletingRoute(null);

      await loadRoutes();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting route:', err);
      setError('Failed to delete route: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openEditModal(route) {
    setEditingRoute(route);
    setEditRouteName(route.name);
    setEditRouteLeaderId(route.routeLeaderId || '');
    setShowEditModal(true);
  }

  function openDeleteModal(route) {
    setDeletingRoute(route);
    setShowDeleteModal(true);
  }

  function getCommunityName(communityId) {
    const community = communities.find(c => c.id === communityId);
    return community?.name || 'Unknown';
  }

  function getRouteLeaderName(leaderId) {
    if (!leaderId) return 'Unassigned';
    const leader = routeLeaders.find(l => l.id === leaderId);
    return leader?.displayName || leader?.email || 'Unknown';
  }

  const isSuperAdmin = role === 'super_admin';

  return (
    <div className="admin-tab-content">
      <div className="admin-section-header">
        <h2>Routes</h2>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Route
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Filters */}
      <div className="filter-section">
        {/* Team selector for super_admin */}
        {isSuperAdmin && (
          <label>
            <span>Team:</span>
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setSelectedCommunityId('');
              }}
              className="select-input"
            >
              <option value="">Select a team</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Community filter */}
        <label>
          <span>Community:</span>
          <select
            value={selectedCommunityId}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
            className="select-input"
            disabled={!selectedTeamId}
          >
            <option value="">All communities</option>
            {communities.map(community => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="loading">Loading routes...</div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <p>No routes found.</p>
          <p>Create one to get started!</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Community</th>
                <th>Route Leader</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(route => (
                <tr key={route.id}>
                  <td>{route.name}</td>
                  <td>{getCommunityName(route.communityId)}</td>
                  <td>{getRouteLeaderName(route.routeLeaderId)}</td>
                  <td>
                    {route.createdAt?.toDate
                      ? route.createdAt.toDate().toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => openEditModal(route)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => openDeleteModal(route)}
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

      {/* Create Route Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Route</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRoute}>
              <div className="form-group">
                <label>Route Name</label>
                <input
                  type="text"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="Enter route name..."
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Community</label>
                <select
                  value={newRouteCommunityId}
                  onChange={(e) => setNewRouteCommunityId(e.target.value)}
                  className="select-input"
                >
                  <option value="">Select a community</option>
                  {communities.map(community => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Route Leader (Optional)</label>
                <select
                  value={newRouteLeaderId}
                  onChange={(e) => setNewRouteLeaderId(e.target.value)}
                  className="select-input"
                >
                  <option value="">Unassigned</option>
                  {routeLeaders.map(leader => (
                    <option key={leader.id} value={leader.id}>
                      {leader.displayName || leader.email} ({leader.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Route</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleEditRoute}>
              <div className="form-group">
                <label>Route Name</label>
                <input
                  type="text"
                  value={editRouteName}
                  onChange={(e) => setEditRouteName(e.target.value)}
                  className="text-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Route Leader</label>
                <select
                  value={editRouteLeaderId}
                  onChange={(e) => setEditRouteLeaderId(e.target.value)}
                  className="select-input"
                >
                  <option value="">Unassigned</option>
                  {routeLeaders.map(leader => (
                    <option key={leader.id} value={leader.id}>
                      {leader.displayName || leader.email} ({leader.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={updating}>
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
              <h3>Delete Route</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deletingRoute?.name}</strong>?
              </p>
              <p className="warning-text">
                This will soft delete the route (it will be hidden but data preserved).
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteRoute}
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
