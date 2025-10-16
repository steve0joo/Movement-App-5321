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
        <h1>Movement App</h1>
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
              <h3>Follow-ups</h3>
              <p>Track next steps</p>
            </button>

            {role === 'admin' && (
              <button
                className="action-card admin-card"
                onClick={() => navigate('/admin/users')}
              >
                <span className="action-icon">👤</span>
                <h3>Manage Users</h3>
                <p>Add/remove route leaders</p>
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
