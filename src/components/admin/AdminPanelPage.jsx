// src/components/admin/AdminPanelPage.jsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import AdminTabs from './AdminTabs';
import UserManagementTab from './UserManagementTab';
import TeamManagementTab from './TeamManagementTab';
import CommunityManagementTab from './CommunityManagementTab';
import BuildingManagementTab from './BuildingManagementTab';
import CommunityInvolvementTab from './CommunityInvolvementTab';

import './AdminPanelPage.css';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const { role } = useAuth();              // 🔹 get role from AuthContext
  const userRole = role ?? 'volunteer';    // fallback just in case

  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = useMemo(
    () => [
      { id: 'users',                label: 'Users',                 icon: '👤',  roles: ['super_admin', 'team_admin'] },
      { id: 'teams',                label: 'Teams',                 icon: '🏢',  roles: ['super_admin'] },
      { id: 'communities',          label: 'Communities',           icon: '🏘️', roles: ['super_admin', 'team_admin'] },
      { id: 'buildings',            label: 'Buildings',             icon: '🏠',  roles: ['super_admin', 'team_admin'] },
      { id: 'communityInvolvement', label: 'Community Involvement', icon: '⚽',  roles: ['super_admin', 'team_admin'] },
    ],
    []
  );

  // Only show tabs the current role is allowed to see
  const visibleTabs = useMemo(
    () => tabs.filter(tab => tab.roles.includes(userRole)),
    [tabs, userRole]
  );

  // Default to first visible tab, or 'users' as a fallback
  const [currentTab, setCurrentTab] = useState(
    visibleTabs[0]?.id || 'users'
  );

  function toggleMenuOpen() {
    setMenuOpen(open => !open);
  }

  // Optional: if role changes and currentTab is no longer allowed, reset it
  if (!visibleTabs.some(tab => tab.id === currentTab) && visibleTabs.length > 0) {
    setCurrentTab(visibleTabs[0].id);
  }

  return (
    <div className="admin-shell">
      {/* --- TOP BAR: menu, logo, Admin pill --- */}
      <header className="admin-topbar">
        <button className="admin-menu-button" onClick={toggleMenuOpen}>
          <span className="menu-line" />
          <span className="menu-line" />
          <span className="menu-line" />
        </button>

        <div className="admin-logo-pill">
          <span>M</span>
        </div>

        <div className="admin-role-pill">Admin</div>

        {menuOpen && (
          <div className="admin-menu-dropdown">
            <button onClick={() => navigate('/')}>Home</button>
            <button onClick={() => navigate('/visit/new')}>New Visit</button>
            <button onClick={() => navigate('/visits')}>Visit History</button>
          </div>
        )}
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="admin-main">
        {/* “Admin Panel” + subtitle + tabs = the package */}
        <section className="admin-panel-header">
          <h1 className="admin-panel-title">Admin Panel</h1>
          <p className="admin-panel-subtitle">
            Manage users, teams, and buildings
          </p>

          <AdminTabs
            tabs={tabs}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            userRole={userRole}     
          />
        </section>

        <section className="admin-panel-body">
          {visibleTabs.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14 }}>
              You do not have permission to view any admin sections.
            </p>
          ) : (
            <>
              {currentTab === 'users' && <UserManagementTab />}
              {currentTab === 'teams' && <TeamManagementTab />}
              {currentTab === 'communities' && <CommunityManagementTab />}
              {currentTab === 'buildings' && <BuildingManagementTab />}
              {currentTab === 'communityInvolvement' && <CommunityInvolvementTab />}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
