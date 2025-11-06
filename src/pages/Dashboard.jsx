import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SyncIndicator from '../components/SyncIndicator';
import './Dashboard.css';

export default function Dashboard() {
  const { logout, currentUser, role } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>The Movement App</h1>
        <div className="user-info">
          <SyncIndicator />
          <span>{currentUser?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            Log Out
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-grid">
            <button
              className="action-card"
              onClick={() => navigate('/collect')}
            >
              <span className="action-icon">📝</span>
              <h3>New Visit</h3>
              <p>Collect family data</p>
            </button>

            <button
              type="button"
              className="action-card"
              onClick={() => navigate('/families')}
              >
              <span className="action-icon">👥</span>
              <h3>Families</h3>
              <p>View all families</p>
            </button>

            <button
              className="action-card"
              onClick={() => navigate('/followups')}
            >
              <span className="action-icon">✅</span>
              <h3>Dashboard</h3>
              <p>Follow-ups</p>
            </button>

            {(role === 'super_admin' || role === 'team_admin') && (
              <button
                className="action-card admin-card"
                onClick={() => navigate('/admin/users')}
              >
                <span className="action-icon">👤</span>
                <h3>Manage Users</h3>
                <p>Add/manage team users</p>
              </button>
            )}

            {(role === 'super_admin' || role === 'team_admin') && (
              <button
                className="action-card admin-card"
                onClick={() => navigate('/access')}
              >
                {/* <span className="action-icon">👤</span> */}
                <h3>Access Codes</h3>
                <p>Add/manage access codes</p>
              </button>
            )}

            {role === 'super_admin' && (
              <button
                className="action-card admin-card"
                onClick={() => navigate('/admin/seed-data')}
              >
                <span className="action-icon">🌱</span>
                <h3>Seed Database</h3>
                <p>Populate with example data</p>
              </button>
            )}
          </div>
        </div>

        <div className="recent-activity">
          <h2>Recent Activity</h2>
          <p className="empty-state">No recent visits yet. Start collecting data!</p>
        </div>
      </div>
    </div>
  );
}
