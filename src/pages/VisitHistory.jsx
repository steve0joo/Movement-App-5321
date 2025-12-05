import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { updateVisit, deleteVisit } from '../services/buildingService';
import { getAllTeams } from '../services/teamService';
import { getCommunitiesByTeam } from '../services/communityService';
import { getAllRouteLeaders } from '../services/userService';
import { getBuildingsByCommunity } from '../services/buildingService';
import './header.css';
import './VisitHistory.css';
import menuIcon from '../assets/menu-button.png';
import logoHome from '../assets/logo-home-button.png';
import Modal from '../components/Modal';

const VisitHistory = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    role,
    teamId: userTeamId,
    routeId: userRouteId,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
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

  function toggleMenu(e) {
    e?.stopPropagation();
    setMenuOpen((s) => !s);
  }

  function handleMenuSelect(item) {
    setMenuOpen(false);
    if (item === 'Home') navigate('/');
    if (item === 'New Visit') navigate('/visits/new');
    if (item === 'Admin Page') navigate('/admin');
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

  // Check if user can delete a visit (same as edit permissions)
  const canDeleteVisit = (visit) => {
    // Super admin can delete everything
    if (role === 'super_admin') {
      return true;
    }

    // Check if user has team assignment
    if (!userTeamId) {
      return false; // Not assigned to any team
    }

    // Team admin can delete visits in their team
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

    // Volunteers cannot delete
    return false;
  };

  // Data state
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Entity data for dropdowns
  const [teams, setTeams] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [buildings, setBuildings] = useState([]);

  // Name lookups (only needed for filter dropdowns, not for display)
  const [communityNames, setCommunityNames] = useState({});
  const [teamNames, setTeamNames] = useState({});

  // Filter state
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedRouteLeaderId, setSelectedRouteLeaderId] = useState('');
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

  // Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info', // 'info' or 'danger'
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
  });

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

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const buildingId = doc.ref.parent.parent?.id;

          if (data && buildingId) {
            fetchedVisits.push({
              id: doc.id,
              buildingId,
              ...data,
              // Visit documents include denormalized names (buildingName, routeName, communityName, teamName)
              // No need to fetch parent entities - everything is already in the visit document
            });
          }
        });

        // ✅ PERFORMANCE FIX: No more N+1 queries for names
        // All entity names are denormalized in visit documents
        console.log(
          '✅ Loaded',
          fetchedVisits.length,
          'visits with denormalized names (no additional database queries needed!)'
        );

        if (!isCancelled) {
          setVisits(fetchedVisits);
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

  // Note: Entity names are now denormalized in visit documents
  // We don't need fetchEntityNames() anymore - all names come from the visit data!

  // Load teams for super_admin
  useEffect(() => {
    if (role === 'super_admin') {
      getAllTeams()
        .then((teams) => {
          setTeams(teams);
          const nameMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
          setTeamNames(nameMap);
        })
        .catch((err) => {
          console.error('Error fetching teams:', err);
        });
    }
  }, [role]);

  // Load communities when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      getCommunitiesByTeam(selectedTeamId)
        .then((communities) => {
          setCommunities(communities);
          const nameMap = Object.fromEntries(
            communities.map((c) => [c.id, c.name])
          );
          setCommunityNames(nameMap);
        })
        .catch((err) => {
          console.error('Error fetching communities:', err);
        });
    } else {
      setCommunities([]);
      setSelectedCommunityId('');
    }
  }, [selectedTeamId]);

  // Load route leaders when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      getAllRouteLeaders()
        .then((allLeaders) => {
          // Filter to only route leaders in the selected team
          const teamLeaders = allLeaders.filter(leader => leader.teamId === selectedTeamId);
          setRouteLeaders(teamLeaders);
        })
        .catch((err) => {
          console.error('Error fetching route leaders:', err);
        });
    } else {
      setRouteLeaders([]);
      setSelectedRouteLeaderId('');
    }
  }, [selectedTeamId]);

  // Load buildings when community is selected
  useEffect(() => {
    if (selectedCommunityId) {
      // Get all buildings in the community
      getBuildingsByCommunity(selectedCommunityId)
        .then((buildings) => {
          setBuildings(buildings);
        })
        .catch((err) => {
          console.error('Error fetching buildings:', err);
        });
    } else {
      setBuildings([]);
      setSelectedBuildingId('');
    }
  }, [selectedCommunityId]);

  // Filter visits based on selected filters
  const filteredVisits = useMemo(() => {
    let filtered = visits;

    // Apply team filter
    if (selectedTeamId) {
      filtered = filtered.filter((v) => v.teamId === selectedTeamId);
    }

    // Apply community filter
    if (selectedCommunityId) {
      filtered = filtered.filter((v) => v.communityId === selectedCommunityId);
    }

    // Apply route leader filter
    if (selectedRouteLeaderId) {
      filtered = filtered.filter((v) => v.routeLeaderId === selectedRouteLeaderId);
    }

    // Apply building filter
    if (selectedBuildingId) {
      filtered = filtered.filter((v) => v.buildingId === selectedBuildingId);
    }

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          (v.buildingName && v.buildingName.toLowerCase().includes(search)) ||
          (v.unitNumber &&
            String(v.unitNumber).toLowerCase().includes(search)) ||
          (v.notes && v.notes.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [
    visits,
    selectedTeamId,
    selectedCommunityId,
    selectedRouteLeaderId,
    selectedBuildingId,
    searchText,
  ]);

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
            visits: [],
          };
        }

        acc[unitKey].visits.push(visit);
        return acc;
      }, {});
    }

    if (groupBy === 'route') {
      // Group by route leader
      return filteredVisits.reduce((acc, visit) => {
        const key = visit.routeLeaderId || 'No Leader';
        // Find the route leader's display name
        const leader = routeLeaders.find(l => l.id === visit.routeLeaderId);
        const label = leader ? (leader.displayName || leader.email || 'Unknown') : 'No Route Leader';
        if (!acc[key]) {
          acc[key] = { label, visits: [] };
        }
        acc[key].visits.push(visit);
        return acc;
      }, {});
    }

    return {};
  }, [filteredVisits, groupBy, routeLeaders]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const toggleVisit = (visitId) => {
    setExpandedVisits((prev) => ({
      ...prev,
      [visitId]: !prev[visitId],
    }));
  };

  // Edit handlers
  const startEditingPerson = (visit, personIndex) => {
    setEditingVisit({
      visitId: visit.id,
      buildingId: visit.buildingId,
      personIndex: personIndex,
    });
    setEditFormData({
      name: visit.people[personIndex].name || '',
      age: visit.people[personIndex].age || '',
      phone: visit.people[personIndex].phone || '',
      followUp: visit.people[personIndex].followUp || '',
      involvement: visit.people[personIndex].involvement || '',
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
        ...editFormData,
      };

      // Update visit in Firestore
      await updateVisit(editingVisit.buildingId, editingVisit.visitId, {
        people: updatedPeople,
      });

      // Update local state
      setVisits((prevVisits) =>
        prevVisits.map((v) =>
          v.id === editingVisit.visitId ? { ...v, people: updatedPeople } : v
        )
      );

      // Clear edit state
      setEditingVisit(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error updating person:', error);
      setModalState({
        isOpen: true,
        type: 'danger',
        title: 'Error',
        message: 'Failed to save changes. Please try again.',
        confirmText: 'OK',
        onConfirm: null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePerson = async (visit, personIndex) => {
    const person = visit.people[personIndex];

    // Show confirmation modal
    const confirmMessage = `Are you sure you want to delete this person?\n\nName: ${
      person.name || 'Unknown'
    }\nAge: ${person.age || 'N/A'}\nPhone: ${
      person.phone || 'N/A'
    }\n\nThis action cannot be undone.`;

    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Person',
      message: confirmMessage,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        setSaving(true);
        try {
          // Create updated people array without the deleted person
          const updatedPeople = visit.people.filter(
            (_, idx) => idx !== personIndex
          );

          // If this was the last person, delete the entire visit
          if (updatedPeople.length === 0) {
            await deleteVisit(visit.buildingId, visit.id);
            // Remove visit from local state
            setVisits((prevVisits) => prevVisits.filter((v) => v.id !== visit.id));

            // Show success message
            setModalState({
              isOpen: true,
              type: 'info',
              title: 'Success',
              message: 'Person deleted. Visit removed as it had no remaining people.',
              confirmText: 'OK',
              onConfirm: null,
            });
          } else {
            // Update visit with remaining people
            await updateVisit(visit.buildingId, visit.id, {
              people: updatedPeople,
            });

            // Update local state
            setVisits((prevVisits) =>
              prevVisits.map((v) =>
                v.id === visit.id ? { ...v, people: updatedPeople } : v
              )
            );

            // Show success message
            setModalState({
              isOpen: true,
              type: 'info',
              title: 'Success',
              message: 'Person deleted successfully.',
              confirmText: 'OK',
              onConfirm: null,
            });
          }
        } catch (error) {
          console.error('Error deleting person:', error);
          setModalState({
            isOpen: true,
            type: 'danger',
            title: 'Error',
            message: `Failed to delete person: ${error.message}`,
            confirmText: 'OK',
            onConfirm: null,
          });
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleDeleteVisit = async (visit) => {
    // Show confirmation modal
    const confirmMessage = `Are you sure you want to delete this ENTIRE visit?\n\nBuilding: ${
      visit.buildingName || 'Unknown'
    }\nUnit: ${visit.unitNumber || 'N/A'}\nDate: ${
      visit.visitDate?.toDate
        ? visit.visitDate.toDate().toLocaleDateString()
        : 'N/A'
    }\nPeople: ${
      visit.people?.length || 0
    } person(s)\n\nThis will delete all people and data associated with this visit.\nThis action cannot be undone.`;

    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Entire Visit',
      message: confirmMessage,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        setSaving(true);
        try {
          // Delete visit from Firestore
          await deleteVisit(visit.buildingId, visit.id);

          // Remove visit from local state
          setVisits((prevVisits) => prevVisits.filter((v) => v.id !== visit.id));

          // Show success message
          setModalState({
            isOpen: true,
            type: 'info',
            title: 'Success',
            message: 'Visit deleted successfully.',
            confirmText: 'OK',
            onConfirm: null,
          });
        } catch (error) {
          console.error('Error deleting visit:', error);
          setModalState({
            isOpen: true,
            type: 'danger',
            title: 'Error',
            message: `Failed to delete visit: ${error.message}`,
            confirmText: 'OK',
            onConfirm: null,
          });
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (!currentUser) {
    return (
      <div className="visit-history-page">
        Please log in to view this content.
      </div>
    );
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
            <div
              className="menu-dropdown"
              role="menu"
              aria-orientation="vertical"
            >
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('Home')}
                role="menuitem"
              >
                Home
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('New Visit')}
                role="menuitem"
              >
                New Visit
              </button>
              {(role === 'super_admin' ||
                role === 'team_admin' ||
                role === 'route_leader') && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuSelect('Admin Page')}
                  role="menuitem"
                >
                  Admin Page
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className="logo-home"
          onClick={() => navigate('/')}
          title="Home"
          aria-label="Go to dashboard"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <img
            src={logoHome}
            alt="Home"
            style={{ height: 36, display: 'block' }}
          />
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
                setSelectedRouteLeaderId('');
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
                  {teams.map((team) => (
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
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Route Leader Filter */}
            <div className="filter-group">
              <label htmlFor="route-leader-filter">Route Leader</label>
              <select
                id="route-leader-filter"
                value={selectedRouteLeaderId}
                onChange={(e) => setSelectedRouteLeaderId(e.target.value)}
                className="filter-select"
                disabled={!selectedTeamId || routeLeaders.length === 0}
              >
                <option value="">All Route Leaders</option>
                {routeLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.displayName || leader.email || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>

            {/* Building Filter */}
            <div className="filter-group">
              <label htmlFor="building-filter">Building</label>
              <select
                id="building-filter"
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="filter-select"
                disabled={!selectedCommunityId}
              >
                <option value="">All Buildings</option>
                {buildings.map((building) => (
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
                Route Leader
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
            Showing <strong>{filteredVisits.length}</strong> visit
            {filteredVisits.length !== 1 ? 's' : ''}
            {groupBy !== 'flat' &&
              ` in ${Object.keys(groupedVisits).length} ${
                groupBy === 'building' ? 'unit' : 'route leader'
              }${Object.keys(groupedVisits).length !== 1 ? 's' : ''}`}
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
            {filteredVisits.map((visit) => (
              <div key={visit.id} className="visit-card">
                <div
                  className="visit-header"
                  onClick={() => toggleVisit(visit.id)}
                >
                  <div className="visit-title">
                    <strong>{visit.buildingName || 'Unknown Building'}</strong>{' '}
                    - Unit {visit.unitNumber || 'N/A'}
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
                      <label>Route Leader:</label>
                      <span>
                        {visit.routeLeaderId
                          ? (routeLeaders.find(l => l.id === visit.routeLeaderId)?.displayName ||
                             routeLeaders.find(l => l.id === visit.routeLeaderId)?.email ||
                             'Unknown')
                          : 'None'}
                      </span>
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
                            const isEditing =
                              editingVisit?.visitId === visit.id &&
                              editingVisit?.personIndex === idx;

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
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            name: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Age:</label>
                                      <input
                                        type="number"
                                        value={editFormData.age}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            age: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Phone:</label>
                                      <input
                                        type="text"
                                        value={editFormData.phone}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            phone: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Follow-up:</label>
                                      <textarea
                                        value={editFormData.followUp}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            followUp: e.target.value,
                                          })
                                        }
                                        className="edit-textarea"
                                        rows="3"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Involvement:</label>
                                      <textarea
                                        value={editFormData.involvement}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            involvement: e.target.value,
                                          })
                                        }
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
                                        <strong>
                                          {person.name || 'Unknown'}
                                        </strong>
                                        {person.age && (
                                          <span> (Age: {person.age})</span>
                                        )}
                                        {person.phone && (
                                          <span> • Phone: {person.phone}</span>
                                        )}
                                      </div>
                                      <div className="person-actions">
                                        {canEditVisit(visit) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startEditingPerson(visit, idx);
                                            }}
                                            className="edit-person-btn"
                                            title="Edit person"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        {canDeleteVisit(visit) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePerson(visit, idx);
                                            }}
                                            className="delete-person-btn"
                                            title="Delete person"
                                            disabled={saving}
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
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
                    {canDeleteVisit(visit) && (
                      <div
                        className="detail-item full-width"
                        style={{
                          marginTop: '16px',
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          onClick={() => handleDeleteVisit(visit)}
                          disabled={saving}
                          className="delete-visit-btn"
                        >
                          {saving ? 'Deleting...' : '🗑️ Delete Entire Visit'}
                        </button>
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
                  className={`group-header ${
                    expandedGroups[groupKey] ? 'expanded' : ''
                  }`}
                  onClick={() => toggleGroup(groupKey)}
                >
                  <h3>{groupData.label}</h3>
                  <span className="visit-count">
                    {groupData.visits.reduce((sum, v) => sum + (v.people?.length || 0), 0)} person
                    {groupData.visits.reduce((sum, v) => sum + (v.people?.length || 0), 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="expand-icon">
                    {expandedGroups[groupKey] ? '−' : '+'}
                  </span>
                </div>
                {expandedGroups[groupKey] && (
                  <div className="group-visits">
                    {/* Flatten all people from all visits */}
                    {groupData.visits.flatMap((visit) =>
                      visit.people && visit.people.length > 0
                        ? visit.people.map((person, idx) => {
                            const isEditing =
                              editingVisit?.visitId === visit.id &&
                              editingVisit?.personIndex === idx;

                            return (
                              <div key={`${visit.id}-${idx}`} className="person-item">
                                {isEditing ? (
                                  // Edit mode
                                  <div className="person-edit-form">
                                    <div className="edit-form-row">
                                      <label>Name:</label>
                                      <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            name: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Age:</label>
                                      <input
                                        type="number"
                                        value={editFormData.age}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            age: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Phone:</label>
                                      <input
                                        type="text"
                                        value={editFormData.phone}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            phone: e.target.value,
                                          })
                                        }
                                        className="edit-input"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Follow-up:</label>
                                      <textarea
                                        value={editFormData.followUp}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            followUp: e.target.value,
                                          })
                                        }
                                        className="edit-textarea"
                                        rows="3"
                                      />
                                    </div>
                                    <div className="edit-form-row">
                                      <label>Involvement:</label>
                                      <textarea
                                        value={editFormData.involvement}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            involvement: e.target.value,
                                          })
                                        }
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
                                      <div className="person-actions">
                                        {canEditVisit(visit) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startEditingPerson(visit, idx);
                                            }}
                                            className="edit-person-btn"
                                            title="Edit person"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        {canDeleteVisit(visit) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePerson(visit, idx);
                                            }}
                                            className="delete-person-btn"
                                            title="Delete person"
                                            disabled={saving}
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
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
                          })
                        : []
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for confirmations and alerts */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
      >
        {modalState.message}
      </Modal>
    </div>
  );
};

export default VisitHistory;
