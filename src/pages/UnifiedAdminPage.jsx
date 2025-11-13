import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminTabs from '../components/admin/AdminTabs';
import UserManagementTab from '../components/admin/UserManagementTab';
import TeamManagementTab from '../components/admin/TeamManagementTab';
import CommunityManagementTab from '../components/admin/CommunityManagementTab';
import RouteManagementTab from '../components/admin/RouteManagementTab';
import BuildingManagementTab from '../components/admin/BuildingManagementTab';
import './AdminStyles.css'; // Shared admin styles

export default function UnifiedAdminPage() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Define available tabs with role-based access
  const tabs = [
    {
      id: 'users',
      label: 'Users',
      icon: '👤',
      roles: ['super_admin', 'team_admin'],
      component: UserManagementTab
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: '🏢',
      roles: ['super_admin'],
      component: TeamManagementTab
    },
    {
      id: 'communities',
      label: 'Communities',
      icon: '🏘️',
      roles: ['super_admin', 'team_admin'],
      component: CommunityManagementTab
    },
    {
      id: 'routes',
      label: 'Routes',
      icon: '🛣️',
      roles: ['super_admin', 'team_admin'],
      component: RouteManagementTab
    },
    {
      id: 'buildings',
      label: 'Buildings',
      icon: '🏠',
      roles: ['super_admin', 'team_admin', 'route_leader'],
      component: BuildingManagementTab
    }
  ];

  // Get initial tab from URL hash or determine default based on role
  function getInitialTab() {
    const hash = location.hash.replace('#', '');
    if (hash && tabs.some(tab => tab.id === hash)) {
      return hash;
    }

    // Default tab based on role
    if (role === 'route_leader') return 'buildings';
    if (role === 'team_admin') return 'users';
    if (role === 'super_admin') return 'users';
    return 'users';
  }

  const [currentTab, setCurrentTab] = useState(getInitialTab());

  // Update current tab when hash changes
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && tabs.some(tab => tab.id === hash)) {
      setCurrentTab(hash);
    }
  }, [location.hash]);

  // Update current tab based on role when role loads
  useEffect(() => {
    if (!authLoading && role) {
      const initialTab = getInitialTab();
      const tabAccessible = tabs.find(tab => tab.id === initialTab)?.roles.includes(role);
      if (!tabAccessible) {
        // Find first accessible tab for this role
        const firstAccessibleTab = tabs.find(tab => tab.roles.includes(role));
        if (firstAccessibleTab) {
          setCurrentTab(firstAccessibleTab.id);
          navigate(`/admin#${firstAccessibleTab.id}`, { replace: true });
        } else {
          // No accessible tabs - redirect to dashboard
          navigate('/');
        }
      }
    }
  }, [role, authLoading]);

  // Check if user has permission to access admin panel
  const canAccessAdmin = role === 'super_admin' || role === 'team_admin' || role === 'route_leader';

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading && !canAccessAdmin) {
      navigate('/');
    }
  }, [authLoading, canAccessAdmin, navigate]);

  // Get the current tab component
  const CurrentTabComponent = tabs.find(tab => tab.id === currentTab)?.component;

  if (authLoading) {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.875rem', color: '#1f2937' }}>
              Admin Panel
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#6b7280' }}>
              Manage users, teams, and buildings
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <AdminTabs
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        userRole={role}
      />

      {/* Tab Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 2rem 2rem 2rem'
      }}>
        {CurrentTabComponent ? <CurrentTabComponent /> : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Tab not found
          </div>
        )}
      </div>
    </div>
  );
}