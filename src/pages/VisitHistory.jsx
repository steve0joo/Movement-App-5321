import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getBuilding, updateVisit } from '../services/buildingService';
import { getAllTeams } from '../services/teamService';
import { getCommunitiesByTeam } from '../services/communityService';
import { getRoutesByCommunity, getRoutesByTeam } from '../services/routeService';
import { getBuildingsByRoute } from '../services/buildingService';
import './header.css';
import './VisitHistory.css';
import menuIcon from "../assets/menu-button.png";
import logoHome from "../assets/logo-home-button.png";


const VisitHistory = () => {
  const navigate = useNavigate();
  const { currentUser, role, teamId: userTeamId, routeId: userRouteId } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleMenu(e) {
    e?.stopPropagation();
    setMenuOpen((s) => !s);
  }

  function handleMenuSelect(item) {
    setMenuOpen(false);
    if (item === "Home") navigate("/");
    if (item === "New Visit") navigate("/visits/new");
    if (item === "Admin Page") navigate("/admin");
  }

  // Check if user can edit a visit based on their assignments
  const canEditVisit = (visit) => {
    // Super admin can edit everything
    if (role === 'super_admin') {
      return true;
    }

    // Check if user has team assignment
    if (!userTeamId) {
      return false; // Not assigned to any team
    }

    // Team admin can edit visits in their team
    if (role === 'team_admin') {
      return visit.teamId === userTeamId;
    }

    // Route leader must have route assignment and visit must be in their route
    if (role === 'route_leader') {
      if (!userRouteId) {
        return false; // Not assigned to any route
      }
      return visit.routeId === userRouteId && visit.teamId === userTeamId;
    }

    // Volunteers cannot edit
    return false;
  };

  // Data state
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Entity data for dropdowns
  const [teams, setTeams] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buildings, setBuildings] = useState([]);

  // Name lookups
  const [buildingNames, setBuildingNames] = useState({});
  const [routeNames, setRouteNames] = useState({});
  const [communityNames, setCommunityNames] = useState({});
  const [teamNames, setTeamNames] = useState({});

  // Filter state
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(userRouteId || '');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  // View options
  const [groupBy, setGroupBy] = useState('building'); // 'building', 'route', 'flat'
  const [searchText, setSearchText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({}); // For buildings/routes
  const [expandedVisits, setExpandedVisits] = useState({}); // For individual visit details

  // Edit mode state
  const [editingVisit, setEditingVisit] = useState(null); // { visitId, buildingId, personIndex }
  const [editFormData, setEditFormData] = useState({}); // Temporary edit data
  const [saving, setSaving] = useState(false);

  // Fetch all visits on mount
  useEffect(() => {
    let isCancelled = false;

    const fetchVisits = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching all visits...');
        console.log('Current user role:', role);
        console.log('Current user teamId:', userTeamId);
        console.log('Current user routeId:', userRouteId);

        const visitsQuery = query(
          collectionGroup(db, 'visits'),
          orderBy('visitDate', 'desc')
        );
        const querySnapshot = await getDocs(visitsQuery);
        const fetchedVisits = [];
        const buildingIds = new Set();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const buildingId = doc.ref.parent.parent?.id;

          if (data && buildingId) {
            buildingIds.add(buildingId);
            fetchedVisits.push({
              id: doc.id,
              buildingId,
              ...data,
              // Visit documents now include denormalized teamId, routeId, communityId
              // No need to overwrite them - they're already in data
            });
          }
        });

        // Fetch building data only for building names (not hierarchy fields)
        console.log('Fetching building names for', buildingIds.size, 'buildings...');
        const buildingDataMap = {};
        const routeIdsSet = new Set();
        const communityIdsSet = new Set();
        const teamIdsSet = new Set();

        await Promise.all(
          Array.from(buildingIds).map(async (buildingId) => {
            try {
              const building = await getBuilding(buildingId);
              if (building) {
                buildingDataMap[buildingId] = building;
              }
            } catch (error) {
              console.error(`Error fetching building ${buildingId}:`, error);
            }
          })
        );

        // Add building names to visits and collect entity IDs
        fetchedVisits.forEach(visit => {
          const building = buildingDataMap[visit.buildingId];
          if (building) {
            visit.buildingName = building.name;
          }
          // Collect entity IDs from denormalized visit fields for name lookups
          if (visit.routeId) routeIdsSet.add(visit.routeId);
          if (visit.communityId) communityIdsSet.add(visit.communityId);
          if (visit.teamId) teamIdsSet.add(visit.teamId);
        });

        if (!isCancelled) {
          console.log('Fetched', fetchedVisits.length, 'visits with building data');
          setVisits(fetchedVisits);

          // Store entity IDs for fetching names
          setBuildingNames(Object.fromEntries(
            Object.entries(buildingDataMap).map(([id, b]) => [id, b.name])
          ));

          // Fetch and store route, community, team names
          await fetchEntityNames(routeIdsSet, communityIdsSet, teamIdsSet);

          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching visits:', err);
          setError(`Failed to load visits: ${err.message}`);
          setLoading(false);
        }
      }
    };

    fetchVisits();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  // Fetch entity names for display
  const fetchEntityNames = async (routeIds, communityIds, teamIds) => {
    try {
      // For now, we'll fetch these as needed in the filter dropdowns
      // This is a placeholder for future optimization
    } catch (error) {
      console.error('Error fetching entity names:', error);
    }
  };

  // Load teams for super_admin
  useEffect(() => {
    if (role === 'super_admin') {
      getAllTeams().then(teams => {
        setTeams(teams);
        const nameMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
        setTeamNames(nameMap);
      }).catch(err => {
        console.error('Error fetching teams:', err);
      });
    }
  }, [role]);

  // Load communities when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      getCommunitiesByTeam(selectedTeamId).then(communities => {
        setCommunities(communities);
        const nameMap = Object.fromEntries(communities.map(c => [c.id, c.name]));
        setCommunityNames(nameMap);
      }).catch(err => {
        console.error('Error fetching communities:', err);
      });
    } else {
      setCommunities([]);
      setSelectedCommunityId('');
    }
  }, [selectedTeamId]);

  // Load routes when community is selected
  useEffect(() => {
    if (selectedCommunityId) {
      getRoutesByCommunity(selectedCommunityId).then(routes => {
        setRoutes(routes);
        const nameMap = Object.fromEntries(routes.map(r => [r.id, r.name]));
        setRouteNames(nameMap);
      }).catch(err => {
        console.error('Error fetching routes:', err);
      });
    } else if (selectedTeamId) {
      // If no community selected but team is, show all routes in team
      getRoutesByTeam(selectedTeamId).then(routes => {
        setRoutes(routes);
        const nameMap = Object.fromEntries(routes.map(r => [r.id, r.name]));
        setRouteNames(nameMap);
      }).catch(err => {
        console.error('Error fetching routes:', err);
      });
    } else {
      setRoutes([]);
      setSelectedRouteId(userRouteId || '');
    }
  }, [selectedCommunityId, selectedTeamId, userRouteId]);

  // Load buildings when route is selected
  useEffect(() => {
    if (selectedRouteId) {
      getBuildingsByRoute(selectedRouteId).then(buildings => {
        setBuildings(buildings);
      }).catch(err => {
        console.error('Error fetching buildings:', err);
      });
    } else {
      setBuildings([]);
      setSelectedBuildingId('');
    }
  }, [selectedRouteId]);

  // Filter visits based on selected filters
  const filteredVisits = useMemo(() => {
    let filtered = visits;

    // Apply team filter
    if (selectedTeamId) {
      filtered = filtered.filter(v => v.teamId === selectedTeamId);
    }

    // Apply community filter
    if (selectedCommunityId) {
      filtered = filtered.filter(v => v.communityId === selectedCommunityId);
    }

    // Apply route filter
    if (selectedRouteId) {
      filtered = filtered.filter(v => v.routeId === selectedRouteId);
    }

    // Apply building filter
    if (selectedBuildingId) {
      filtered = filtered.filter(v => v.buildingId === selectedBuildingId);
    }

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(v =>
        (v.buildingName && v.buildingName.toLowerCase().includes(search)) ||
        (v.unitNumber && String(v.unitNumber).toLowerCase().includes(search)) ||
        (v.notes && v.notes.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [visits, selectedTeamId, selectedCommunityId, selectedRouteId, selectedBuildingId, searchText]);

  // Group visits based on groupBy option
  const groupedVisits = useMemo(() => {
    if (groupBy === 'flat') {
      return { 'All Visits': filteredVisits };
    }

    if (groupBy === 'building') {
      // Group by building & unit combination
      return filteredVisits.reduce((acc, visit) => {
        const buildingKey = visit.buildingId || 'Unknown';
        const buildingLabel = visit.buildingName || `Building ${buildingKey}`;
        const unitKey = `${buildingKey}-${visit.unitNumber || 'NoUnit'}`;
        const label = `${buildingLabel} - Unit ${visit.unitNumber || 'N/A'}`;

        if (!acc[unitKey]) {
          acc[unitKey] = {
            label: label,
            buildingName: buildingLabel,
            unitNumber: visit.unitNumber,
            visits: []
          };
        }

        acc[unitKey].visits.push(visit);
        return acc;
      }, {});
    }

    if (groupBy === 'route') {
      return filteredVisits.reduce((acc, visit) => {
        const key = visit.routeId || 'Unknown';
        const label = routeNames[key] || `Route ${key}`;
        if (!acc[key]) {
          acc[key] = { label, visits: [] };
        }
        acc[key].visits.push(visit);
        return acc;
      }, {});
    }

    return {};
  }, [filteredVisits, groupBy, routeNames]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const toggleVisit = (visitId) => {
    setExpandedVisits(prev => ({
      ...prev,
      [visitId]: !prev[visitId]
    }));
  };

  // Edit handlers
  const startEditingPerson = (visit, personIndex) => {
    setEditingVisit({
      visitId: visit.id,
      buildingId: visit.buildingId,
      personIndex: personIndex
    });
    setEditFormData({
      name: visit.people[personIndex].name || '',
      age: visit.people[personIndex].age || '',
      phone: visit.people[personIndex].phone || '',
      followUp: visit.people[personIndex].followUp || '',
      involvement: visit.people[personIndex].involvement || ''
    });
  };

  const cancelEdit = () => {
    setEditingVisit(null);
    setEditFormData({});
  };

  const saveEdit = async (visit) => {
    if (!editingVisit) return;

    setSaving(true);
    try {
      // Create updated people array
      const updatedPeople = [...visit.people];
      updatedPeople[editingVisit.personIndex] = {
        ...updatedPeople[editingVisit.personIndex],
        ...editFormData
      };

      // Update visit in Firestore
      await updateVisit(editingVisit.buildingId, editingVisit.visitId, {
        people: updatedPeople
      });

      // Update local state
      setVisits(prevVisits =>
        prevVisits.map(v =>
          v.id === editingVisit.visitId
            ? { ...v, people: updatedPeople }
            : v
        )
      );

      // Clear edit state
      setEditingVisit(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return <div className="visit-history-page">Please log in to view this content.</div>;
  }

  if (loading) {
    return (
      <div className="visit-history-page">
        <div className="loading">Loading visits...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="visit-history-page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="all-page">
      <header className="all-header">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            onClick={toggleMenu}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            type="button"
          >
            <img src={menuIcon} alt="Menu" />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-orientation="vertical">
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("Home")} role="menuitem">
                Home
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("New Visit")} role="menuitem">
                New Visit
              </button>
              {(role === 'super_admin' || role === 'team_admin' || role === 'route_leader') && (
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("Admin Page")} role="menuitem">
                Admin Page
              </button>)}
            </div>
          )}
        </div>

        <button
          className="logo-home"
          onClick={() => navigate("/")}
          title="Home"
          aria-label="Go to dashboard"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <img src={logoHome} alt="Home" style={{ height: 36, display: "block" }} />
        </button>
      </header>
      
      {/* Filters Section */}
      <div className="visit-history-page">
        <div className="filters-section">
          <div className="filters-header">
            <h2>Filters</h2>
            <button
              className="clear-filters-btn"
              onClick={() => {
                if (role !== 'super_admin') {
                  setSelectedTeamId(userTeamId || '');
                } else {
                  setSelectedTeamId('');
                }
                setSelectedCommunityId('');
                if (role !== 'route_leader') {
                  setSelectedRouteId('');
                } else {
                  setSelectedRouteId(userRouteId || '');
                }
                setSelectedBuildingId('');
                setSearchText('');
              }}
            >
              Clear Filters
            </button>
          </div>

          <div className="filter-controls">
            {/* Team Filter - only for super_admin */}
            {role === 'super_admin' && (
              <div className="filter-group">
                <label htmlFor="team-filter">Team</label>
                <select
                  id="team-filter"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Community Filter */}
            <div className="filter-group">
              <label htmlFor="community-filter">Community</label>
              <select
                id="community-filter"
                value={selectedCommunityId}
                onChange={(e) => setSelectedCommunityId(e.target.value)}
                className="filter-select"
                disabled={!selectedTeamId && role === 'super_admin'}
              >
                <option value="">All Communities</option>
                {communities.map(community => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Route Filter - locked for route_leader */}
            <div className="filter-group">
              <label htmlFor="route-filter">Route</label>
              <select
                id="route-filter"
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="filter-select"
                disabled={role === 'route_leader'}
              >
                <option value="">All Routes</option>
                {routes.map(route => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
              {role === 'route_leader' && (
                <small className="filter-note">Locked to your assigned route</small>
              )}
            </div>

            {/* Building Filter */}
            <div className="filter-group">
              <label htmlFor="building-filter">Building</label>
              <select
                id="building-filter"
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="filter-select"
                disabled={!selectedRouteId}
              >
                <option value="">All Buildings</option>
                {buildings.map(building => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="filter-group">
              <label htmlFor="search-filter">Search</label>
              <input
                id="search-filter"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search building, unit, notes..."
                className="filter-input"
              />
            </div>
          </div>

          {/* Group By Options */}
          <div className="view-options">
            <label>Group By:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  value="building"
                  checked={groupBy === 'building'}
                  onChange={(e) => setGroupBy(e.target.value)}
                />
                Building
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="route"
                  checked={groupBy === 'route'}
                  onChange={(e) => setGroupBy(e.target.value)}
                />
                Route
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="flat"
                  checked={groupBy === 'flat'}
                  onChange={(e) => setGroupBy(e.target.value)}
                />
                Flat List
              </label>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="results-summary">
          <p>
            Showing <strong>{filteredVisits.length}</strong> visit{filteredVisits.length !== 1 ? 's' : ''}
            {groupBy !== 'flat' && ` in ${Object.keys(groupedVisits).length} ${groupBy === 'building' ? 'unit' : 'route'}${Object.keys(groupedVisits).length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Visits Display */}
        {filteredVisits.length === 0 ? (
          <div className="empty-state">
            <p>No visits found matching your filters.</p>
            <button
              type="button"
              onClick={() => navigate('/visits/new')}
              className="primary-button"
            >
              Record a Visit
            </button>
          </div>
        ) : groupBy === 'flat' ? (
          // Flat list view
          <div className="visits-list">
            {filteredVisits.map(visit => (
              <div key={visit.id} className="visit-card">
                <div
                  className="visit-header"
                  onClick={() => toggleVisit(visit.id)}
                >
                  <div className="visit-title">
                    <strong>{visit.buildingName || 'Unknown Building'}</strong> - Unit {visit.unitNumber || 'N/A'}
                  </div>
                  <div className="visit-date">
                    {visit.visitDate?.toDate
                      ? visit.visitDate.toDate().toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <span className="expand-icon">
                    {expandedVisits[visit.id] ? '−' : '+'}
                  </span>
                </div>
                {expandedVisits[visit.id] && (
                  <div className="visit-details">
                    <div className="detail-item">
                      <label>Building:</label>
                      <span>{visit.buildingName || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Unit:</label>
                      <span>{visit.unitNumber || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Route:</label>
                      <span>{routeNames[visit.routeId] || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Visit Date:</label>
                      <span>
                        {visit.visitDate?.toDate
                          ? visit.visitDate.toDate().toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    {visit.people && visit.people.length > 0 && (
                      <div className="detail-item full-width">
                        <label>People Visited:</label>
                        <div className="people-list">
                          {visit.people.map((person, idx) => {
                            const isEditing = editingVisit?.visitId === visit.id && editingVisit?.personIndex === idx;

                            return (
                              <div key={idx} className="person-item">
                                {isEditing ? (
                                  // Edit mode
                                  <div className="person-edit-form">
                                    <div className="edit-form-row">
                                      <label>Name:</label>
                                      <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Age:</label>
                                      <input
                                        type="number"
                                        value={editFormData.age}
                                        onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Phone:</label>
                                      <input
                                        type="text"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Follow-up:</label>
                                      <textarea
                                        value={editFormData.followUp}
                                        onChange={(e) => setEditFormData({ ...editFormData, followUp: e.target.value })}
                                        className="edit-textarea"
                                        rows="3"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Involvement:</label>
                                      <textarea
                                        value={editFormData.involvement}
                                        onChange={(e) => setEditFormData({ ...editFormData, involvement: e.target.value })}
                                        className="edit-textarea"
                                        rows="2"
                                      />
                                    </div>
                                    <div className="edit-form-actions">
                                      <button
                                        onClick={() => saveEdit(visit)}
                                        disabled={saving}
                                        className="save-btn"
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className="cancel-btn"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // View mode
                                  <>
                                    <div className="person-header">
                                      <div>
                                        <strong>{person.name || 'Unknown'}</strong>
                                        {person.age && <span> (Age: {person.age})</span>}
                                        {person.phone && <span> • Phone: {person.phone}</span>}
                                      </div>
                                      {role !== 'volunteer' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditingPerson(visit, idx);
                                          }}
                                          className="edit-person-btn"
                                          title="Edit person"
                                        >
                                          ✏️ Edit
                                        </button>
                                      )}
                                    </div>
                                    {person.followUp && (
                                      <div className="person-followup">
                                        Follow-up: {person.followUp}
                                      </div>
                                    )}
                                    {person.involvement && (
                                      <div className="person-involvement">
                                        Involvement: {person.involvement}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="detail-item full-width">
                      <label>Notes:</label>
                      <p>{visit.notes || 'No notes'}</p>
                    </div>
                    {visit.photoUrls && visit.photoUrls.length > 0 && (
                      <div className="detail-item">
                        <label>Photos:</label>
                        <span>{visit.photoUrls.length} photo(s)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Grouped view (by building/unit or route)
          <div className="visits-grouped">
            {Object.entries(groupedVisits).map(([groupKey, groupData]) => (
              <div key={groupKey} className="visit-group">
                <div
                  className={`group-header ${expandedGroups[groupKey] ? 'expanded' : ''}`}
                  onClick={() => toggleGroup(groupKey)}
                >
                  <h3>{groupData.label}</h3>
                  <span className="visit-count">
                    {groupData.visits.length} visit{groupData.visits.length !== 1 ? 's' : ''}
                  </span>
                  <span className="expand-icon">
                    {expandedGroups[groupKey] ? '−' : '+'}
                  </span>
                </div>
                {expandedGroups[groupKey] && (
                  <div className="group-visits">
                    {groupData.visits.map(visit => (
                      <div key={visit.id} className="visit-item">
                        <div
                          className="visit-item-header"
                          onClick={() => toggleVisit(visit.id)}
                        >
                          <span className="visit-unit">
                            {visit.visitDate?.toDate
                              ? visit.visitDate.toDate().toLocaleDateString()
                              : 'N/A'}
                          </span>
                          <span className="expand-icon-small">
                            {expandedVisits[visit.id] ? '−' : '+'}
                          </span>
                        </div>
                        {expandedVisits[visit.id] && (
                          <div className="visit-item-details">
                            <div className="detail-grid">
                              <div className="detail-item">
                                <label>Visit Date:</label>
                                <span>
                                  {visit.visitDate?.toDate
                                    ? visit.visitDate.toDate().toLocaleDateString()
                                    : 'N/A'}
                                </span>
                              </div>
                              {visit.people && visit.people.length > 0 && (
                                <div className="detail-item full-width">
                                  <label>People Visited:</label>
                                  <div className="people-list">
                                    {visit.people.map((person, idx) => {
                                      const isEditing = editingVisit?.visitId === visit.id && editingVisit?.personIndex === idx;

                                      return (
                                        <div key={idx} className="person-item">
                                          {isEditing ? (
                                            // Edit mode
                                            <div className="person-edit-form">
                                              <div className="edit-form-row">
                                                <label>Name:</label>
                                                <input
                                                  type="text"
                                                  value={editFormData.name}
                                                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                  className="edit-input"
                                                />
                                              </div>
                                              <div className="edit-form-row">
                                                <label>Age:</label>
                                                <input
                                                  type="number"
                                                  value={editFormData.age}
                                                  onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                                                  className="edit-input"
                                                />
                                              </div>
                                              <div className="edit-form-row">
                                                <label>Phone:</label>
                                                <input
                                                  type="text"
                                                  value={editFormData.phone}
                                                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                                  className="edit-input"
                                                />
                                              </div>
                                              <div className="edit-form-row">
                                                <label>Follow-up:</label>
                                                <textarea
                                                  value={editFormData.followUp}
                                                  onChange={(e) => setEditFormData({ ...editFormData, followUp: e.target.value })}
                                                  className="edit-textarea"
                                                  rows="3"
                                                />
                                              </div>
                                              <div className="edit-form-row">
                                                <label>Involvement:</label>
                                                <textarea
                                                  value={editFormData.involvement}
                                                  onChange={(e) => setEditFormData({ ...editFormData, involvement: e.target.value })}
                                                  className="edit-textarea"
                                                  rows="2"
                                                />
                                              </div>
                                              <div className="edit-form-actions">
                                                <button
                                                  onClick={() => saveEdit(visit)}
                                                  disabled={saving}
                                                  className="save-btn"
                                                >
                                                  {saving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                  onClick={cancelEdit}
                                                  disabled={saving}
                                                  className="cancel-btn"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            // View mode
                                            <>
                                              <div className="person-header">
                                                <div>
                                                  <strong>{person.name || 'Unknown'}</strong>
                                                  {person.age && <span> (Age: {person.age})</span>}
                                                  {person.phone && <span> • Phone: {person.phone}</span>}
                                                </div>
                                                {canEditVisit(visit) && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditingPerson(visit, idx);
                                                    }}
                                                    className="edit-person-btn"
                                                    title="Edit person"
                                                  >
                                                    ✏️ Edit
                                                  </button>
                                                )}
                                              </div>
                                              {person.followUp && (
                                                <div className="person-followup">
                                                  Follow-up: {person.followUp}
                                                </div>
                                              )}
                                              {person.involvement && (
                                                <div className="person-involvement">
                                                  Involvement: {person.involvement}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="detail-item full-width">
                                <label>Notes:</label>
                                <p>{visit.notes || 'No notes'}</p>
                              </div>
                              {visit.photoUrls && visit.photoUrls.length > 0 && (
                                <div className="detail-item">
                                  <label>Photos:</label>
                                  <span>{visit.photoUrls.length} photo(s)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitHistory;
