import "./Dashboard.css";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>The Movement App</h1>
        <div className="user-info">
          <span>Welcome</span>
          <button className="btn-logout" onClick={() => navigate("/login")}>
            Log Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-grid">
            <button className="action-card" onClick={() => navigate("/followups")}>
              <span className="action-icon">✅</span>
              <h3>Follow-ups</h3>
              <p>dashboard</p>
            </button>

            <button className="action-card" onClick={() => navigate("/members")}>
              <span className="action-icon">👥</span>
              <h3>Members</h3>
              <p>View all members</p>ß
            </button>

          </div>
        </section>

        <section className="recent-activity">
          <h2>Recent Activity</h2>
          <div className="empty-state">No recent activity yet. Start collecting data!</div>
        </section>
      </main>
    </div>
  );
}
