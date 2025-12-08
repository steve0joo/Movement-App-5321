import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { updateVisit, deleteVisit, getBuildingsByCommunity } from '../services/buildingService';
import { getAllTeams } from '../services/teamService';
import { getCommunitiesByTeam } from '../services/communityService';
import { getAllRouteLeaders } from '../services/userService';
import { getFollowUpsByTeam } from '../services/communityInvolvementService';
import './header.css';
import './VisitHistory.css';
import menuIcon from '../assets/menu-button.png';
import logoHome from '../assets/logo-home-button.png';
import Modal from '../components/Modal';
import PendingAssignment from './PendingAssignment';

const VisitHistory = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    role,
    teamId: userTeamId,
    routeId: userRouteId,
  } = useAuth();

  const hasTeamAssignment = userTeamId || role === 'super_admin';
  if (!hasTeamAssignment) {
    return <PendingAssignment />;
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // responsive flags
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
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

  const canEditVisit = (visit) => {
    if (role === 'super_admin') return true;
    if (!userTeamId) return false;
    if (role === 'team_admin') return visit.teamId === userTeamId;
    if (role === 'route_leader') return visit.teamId === userTeamId;
    return false;
  };

  const canDeleteVisit = (visit) => {
    if (role === 'super_admin') return true;
    if (!userTeamId) return false;
    if (role === 'team_admin') return visit.teamId === userTeamId;
    if (role === 'route_leader') return visit.teamId === userTeamId;
    return false;
  };

  // Data state
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Entity data
  const [teams, setTeams] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [followUps, setFollowUps] = useState([]);

  const [communityNames, setCommunityNames] = useState({});
  const [teamNames, setTeamNames] = useState({});

  // Filters
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || '');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedRouteLeaderId, setSelectedRouteLeaderId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFollowUpId, setSelectedFollowUpId] = useState('');
  const [searchText, setSearchText] = useState('');

  // grouping + editing
  const [expandedGroups, setExpandedGroups] = useState({});
  const [editingVisit, setEditingVisit] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
  });

  // helper to clear all filters (used in desktop Clear + mobile Clear)
  const resetFilters = () => {
    if (role !== 'super_admin') {
      setSelectedTeamId(userTeamId || '');
    } else {
      setSelectedTeamId('');
    }
    setSelectedCommunityId('');
    setSelectedRouteLeaderId('');
    setSelectedBuildingId('');
    setSelectedFollowUpId('');
    setSearchText('');
  };

  // Fetch visits
  useEffect(() => {
    let isCancelled = false;

    const fetchVisits = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const visitsQuery = query(
          collectionGroup(db, 'visits'),
          orderBy('visitDate', 'desc')
        );
        const querySnapshot = await getDocs(visitsQuery);
        const fetched = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const buildingId = doc.ref.parent.parent?.id;
          if (data && buildingId) {
            fetched.push({
              id: doc.id,
              buildingId,
              ...data,
            });
          }
        });

        if (!isCancelled) {
          setVisits(fetched);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(`Failed to load visits: ${err.message}`);
          setLoading(false);
        }
      }
    };

    fetchVisits();
    return () => {
      isCancelled = true;
    };
  }, [currentUser, role, userTeamId, userRouteId]);

  // teams
  useEffect(() => {
    if (role === 'super_admin') {
      getAllTeams()
        .then((teams) => {
          setTeams(teams);
          const map = Object.fromEntries(teams.map((t) => [t.id, t.name]));
          setTeamNames(map);
        })
        .catch((err) => console.error('Error fetching teams:', err));
    }
  }, [role]);

  // communities
  useEffect(() => {
    if (selectedTeamId) {
      getCommunitiesByTeam(selectedTeamId)
        .then((communities) => {
          setCommunities(communities);
          const map = Object.fromEntries(communities.map((c) => [c.id, c.name]));
          setCommunityNames(map);
        })
        .catch((err) => console.error('Error fetching communities:', err));
    } else {
      setCommunities([]);
      setSelectedCommunityId('');
    }
  }, [selectedTeamId]);

  // route leaders
  useEffect(() => {
    if (selectedTeamId) {
      getAllRouteLeaders()
        .then((allLeaders) => {
          const teamLeaders = allLeaders.filter(
            (leader) => leader.teamId === selectedTeamId
          );
          setRouteLeaders(teamLeaders);
        })
        .catch((err) => console.error('Error fetching route leaders:', err));
    } else {
      setRouteLeaders([]);
      setSelectedRouteLeaderId('');
    }
  }, [selectedTeamId]);

  // follow-ups
  useEffect(() => {
    if (selectedTeamId) {
      getFollowUpsByTeam(selectedTeamId)
        .then((res) => setFollowUps(res))
        .catch((err) => console.error('Error fetching follow-ups:', err));
    } else {
      setFollowUps([]);
      setSelectedFollowUpId('');
    }
  }, [selectedTeamId]);

  // buildings
  useEffect(() => {
    if (selectedCommunityId) {
      getBuildingsByCommunity(selectedCommunityId)
        .then((res) => setBuildings(res))
        .catch((err) => console.error('Error fetching buildings:', err));
    } else {
      setBuildings([]);
      setSelectedBuildingId('');
    }
  }, [selectedCommunityId]);

  // filtered visits
  const filteredVisits = useMemo(() => {
    let filtered = visits;

    if (selectedTeamId) {
      filtered = filtered.filter((v) => v.teamId === selectedTeamId);
    }
    if (selectedCommunityId) {
      filtered = filtered.filter((v) => v.communityId === selectedCommunityId);
    }
    if (selectedRouteLeaderId) {
      filtered = filtered.filter(
        (v) => v.routeLeaderId === selectedRouteLeaderId
      );
    }
    if (selectedBuildingId) {
      filtered = filtered.filter((v) => v.buildingId === selectedBuildingId);
    }
    if (selectedFollowUpId) {
      const followUp = followUps.find((f) => f.id === selectedFollowUpId);
      if (followUp) {
        filtered = filtered.filter(
          (v) =>
            v.people &&
            v.people.some((person) => person.followUp === followUp.name)
        );
      }
    }
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          (v.buildingName && v.buildingName.toLowerCase().includes(s)) ||
          (v.unitNumber &&
            String(v.unitNumber).toLowerCase().includes(s)) ||
          (v.notes && v.notes.toLowerCase().includes(s))
      );
    }

    return filtered;
  }, [
    visits,
    selectedTeamId,
    selectedCommunityId,
    selectedRouteLeaderId,
    selectedBuildingId,
    selectedFollowUpId,
    followUps,
    searchText,
  ]);

  const groupedVisits = useMemo(() => {
    const grouped = filteredVisits.reduce((acc, visit) => {
      const buildingKey = visit.buildingId || 'Unknown';
      const buildingLabel = visit.buildingName || `Building ${buildingKey}`;
      const unitKey = `${buildingKey}-${visit.unitNumber || 'NoUnit'}`;
      const label = `${buildingLabel} - Unit ${visit.unitNumber || 'N/A'}`;

      if (!acc[unitKey]) {
        acc[unitKey] = {
          label,
          buildingName: buildingLabel,
          unitNumber: visit.unitNumber,
          visits: [],
        };
      }
      acc[unitKey].visits.push(visit);
      return acc;
    }, {});

    Object.keys(grouped).forEach((key) => {
      grouped[key].visits.sort((a, b) => {
        const dateA = a.visitDate?.toDate ? a.visitDate.toDate() : new Date(0);
        const dateB = b.visitDate?.toDate ? b.visitDate.toDate() : new Date(0);
        return dateB - dateA;
      });
      grouped[key].visits = [grouped[key].visits[0]];
    });

    return grouped;
  }, [filteredVisits]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // edit handlers
  const startEditingPerson = (visit, personIndex) => {
    setEditingVisit({
      visitId: visit.id,
      buildingId: visit.buildingId,
      personIndex,
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
      const updatedPeople = [...visit.people];
      updatedPeople[editingVisit.personIndex] = {
        ...updatedPeople[editingVisit.personIndex],
        ...editFormData,
      };

      await updateVisit(editingVisit.buildingId, editingVisit.visitId, {
        people: updatedPeople,
      });

      setVisits((prev) =>
        prev.map((v) =>
          v.id === editingVisit.visitId ? { ...v, people: updatedPeople } : v
        )
      );

      setEditingVisit(null);
      setEditFormData({});
    } catch (err) {
      console.error('Error updating person:', err);
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
          const updatedPeople = visit.people.filter(
            (_, idx) => idx !== personIndex
          );

          if (updatedPeople.length === 0) {
            await deleteVisit(visit.buildingId, visit.id);
            setVisits((prev) => prev.filter((v) => v.id !== visit.id));
            setModalState({
              isOpen: true,
              type: 'info',
              title: 'Success',
              message:
                'Person deleted. Visit removed as it had no remaining people.',
              confirmText: 'OK',
              onConfirm: null,
            });
          } else {
            await updateVisit(visit.buildingId, visit.id, {
              people: updatedPeople,
            });
            setVisits((prev) =>
              prev.map((v) =>
                v.id === visit.id ? { ...v, people: updatedPeople } : v
              )
            );
            setModalState({
              isOpen: true,
              type: 'info',
              title: 'Success',
              message: 'Person deleted successfully.',
              confirmText: 'OK',
              onConfirm: null,
            });
          }
        } catch (err) {
          console.error('Error deleting person:', err);
          setModalState({
            isOpen: true,
            type: 'danger',
            title: 'Error',
            message: `Failed to delete person: ${err.message}`,
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
          await deleteVisit(visit.buildingId, visit.id);
          setVisits((prev) => prev.filter((v) => v.id !== visit.id));
          setModalState({
            isOpen: true,
            type: 'info',
            title: 'Success',
            message: 'Visit deleted successfully.',
            confirmText: 'OK',
            onConfirm: null,
          });
        } catch (err) {
          console.error('Error deleting visit:', err);
          setModalState({
            isOpen: true,
            type: 'danger',
            title: 'Error',
            message: `Failed to delete visit: ${err.message}`,
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

      <div className="visit-history-page">
        {/* Filters */}
        <div className="filters-section">
          <div className="filters-header">
            <h2>Filters</h2>
            {!isMobile && (
              <button
                className="clear-filters-btn"
                type="button"
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Mobile: Team picker separate, above Filter + Sort */}
          {isMobile && role === 'super_admin' && (
            <div className="mobile-team-filter">
              <label
                className="mobile-team-label"
                htmlFor="team-filter-mobile-top"
              >
                Team
              </label>
              <select
                id="team-filter-mobile-top"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="mobile-team-select"
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

          {/* Mobile: Filter + Sort pill */}
          {isMobile && (
            <button
              type="button"
              className="edit-filters-btn"
              onClick={() => setShowFilterPanel(true)}
            >
              Filter + Sort
            </button>
          )}

          {/* Desktop inline filters */}
          {!isMobile && (
            <div className="filter-controls desktop-filters">
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

              <div className="filter-group">
                <label htmlFor="followup-filter">Follow-ups/Urgency</label>
                <select
                  id="followup-filter"
                  value={selectedFollowUpId}
                  onChange={(e) => setSelectedFollowUpId(e.target.value)}
                  className="filter-select"
                  disabled={!selectedTeamId || followUps.length === 0}
                >
                  <option value="">All Follow-ups</option>
                  {followUps.map((followUp) => (
                    <option key={followUp.id} value={followUp.id}>
                      {followUp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group search-filter-group">
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
          )}
        </div>

        {/* Results summary */}
        <div className="results-summary">
          <p>
            Showing <strong>{filteredVisits.length}</strong> visit
            {filteredVisits.length !== 1 ? 's' : ''} in{' '}
            {Object.keys(groupedVisits).length} unit
            {Object.keys(groupedVisits).length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Visits */}
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
        ) : (
          <div className="visits-grouped">
            {Object.entries(groupedVisits).map(([groupKey, group]) => {
              const visit = group.visits[0];
              return (
                <div key={groupKey} className="visit-group">
                  <div
                    className={`group-header ${
                      expandedGroups[groupKey] ? 'expanded' : ''
                    }`}
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <h3>{group.label}</h3>
                    <span className="visit-date">
                      {visit.visitDate?.toDate
                        ? visit.visitDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </span>
                    <span className="expand-icon">
                      {expandedGroups[groupKey] ? '−' : '+'}
                    </span>
                  </div>

                  {expandedGroups[groupKey] && (
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
                            ? routeLeaders.find(
                                (l) => l.id === visit.routeLeaderId
                              )?.displayName ||
                              routeLeaders.find(
                                (l) => l.id === visit.routeLeaderId
                              )?.email ||
                              'Unknown'
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
                                    <>
                                      <div className="person-header">
                                        <div>
                                          <strong>
                                            {person.name || 'Unknown'}
                                          </strong>
                                          {person.age && (
                                            <span> • 🎂 {person.age}</span>
                                          )}
                                          {person.phone && (
                                            <span> • 📞 {person.phone}</span>
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
                            {saving
                              ? 'Deleting...'
                              : '🗑️ Delete Entire Visit'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile filter sheet */}
        {isMobile && showFilterPanel && (
          <div
            className="filter-panel-overlay"
            onClick={() => setShowFilterPanel(false)}
          >
            <div
              className="filter-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="filter-panel-header">
                <h3>Filter &amp; Sort</h3>
                <button
                  type="button"
                  className="filter-panel-close"
                  onClick={() => setShowFilterPanel(false)}
                >
                  ×
                </button>
              </div>

              <div className="filter-panel-body">
                <div className="filter-group">
                  <label htmlFor="community-filter-mobile">Community</label>
                  <select
                    id="community-filter-mobile"
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

                <div className="filter-group">
                  <label htmlFor="route-leader-filter-mobile">
                    Route Leader
                  </label>
                  <select
                    id="route-leader-filter-mobile"
                    value={selectedRouteLeaderId}
                    onChange={(e) =>
                      setSelectedRouteLeaderId(e.target.value)
                    }
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

                <div className="filter-group">
                  <label htmlFor="building-filter-mobile">Building</label>
                  <select
                    id="building-filter-mobile"
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

                <div className="filter-group">
                  <label htmlFor="followup-filter-mobile">
                    Follow-ups/Urgency
                  </label>
                  <select
                    id="followup-filter-mobile"
                    value={selectedFollowUpId}
                    onChange={(e) =>
                      setSelectedFollowUpId(e.target.value)
                    }
                    className="filter-select"
                    disabled={!selectedTeamId || followUps.length === 0}
                  >
                    <option value="">All Follow-ups</option>
                    {followUps.map((followUp) => (
                      <option key={followUp.id} value={followUp.id}>
                        {followUp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group search-filter-group">
                  <label htmlFor="search-filter-mobile">Search</label>
                  <input
                    id="search-filter-mobile"
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search building, unit, notes..."
                    className="filter-input"
                  />
                </div>
              </div>

              <div className="filter-panel-footer">
                <button
                  type="button"
                  className="filter-panel-clear"
                  onClick={resetFilters}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="filter-panel-apply"
                  onClick={() => setShowFilterPanel(false)}
                >
                  See Results
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
