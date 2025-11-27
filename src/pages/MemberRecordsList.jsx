import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMemberRecordsByUnit } from '../services/memberRecordService';
import MemberRecord from './MemberRecord';
import './MemberRecordsList.css';

export default function MemberRecordsList({ buildingId, unitNumber, onClose }) {
  const { currentUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sortBy, setSortBy] = useState('name'); // name, date, lastUpdated
  const [filterText, setFilterText] = useState('');

  // Load member records on mount
  useEffect(() => {
    async function loadRecords() {
      try {
        setLoading(true);
        setError('');
        const data = await getMemberRecordsByUnit(buildingId, unitNumber);
        setRecords(data);
      } catch (err) {
        console.error('Error loading member records:', err);
        setError('Failed to load member records');
      } finally {
        setLoading(false);
      }
    }

    if (buildingId && unitNumber) {
      loadRecords();
    }
  }, [buildingId, unitNumber]);

  // Filter records based on search text
  const filteredRecords = records.filter((record) => {
    if (!filterText) return true;
    const searchLower = filterText.toLowerCase();
    return (
      record.personName?.toLowerCase().includes(searchLower) ||
      record.firstName?.toLowerCase().includes(searchLower) ||
      record.lastName?.toLowerCase().includes(searchLower) ||
      record.phone?.toLowerCase().includes(searchLower) ||
      record.email?.toLowerCase().includes(searchLower)
    );
  });

  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.personName || '').localeCompare(b.personName || '');
      case 'firstName':
        return (a.firstName || '').localeCompare(b.firstName || '');
      case 'lastName':
        return (a.lastName || '').localeCompare(b.lastName || '');
      case 'date':
        // Sort by creation date (newest first)
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'lastUpdated':
        // Sort by update date (newest first)
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      default:
        return 0;
    }
  });

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAge = (record) => {
    if (record.age) return record.age;
    if (record.dateOfBirth) {
      const birthDate = new Date(record.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    return 'N/A';
  };

  if (loading) {
    return (
      <div className="member-records-list-overlay">
        <div className="member-records-list-container">
          <div className="member-records-list-loading">Loading member records...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="member-records-list-overlay">
        <div className="member-records-list-container">
          {/* Header */}
          <div className="member-records-list-header">
            <h2 className="member-records-list-title">
              Past Member Records - Unit {unitNumber}
            </h2>
            <button
              className="member-records-list-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Controls */}
          <div className="member-records-list-controls">
            {/* Search */}
            <div className="member-records-list-search">
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="member-records-list-search-input"
              />
            </div>

            {/* Sort */}
            <div className="member-records-list-sort">
              <label htmlFor="sort-select">Sort by:</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="member-records-list-sort-select"
              >
                <option value="name">Name (A-Z)</option>
                <option value="firstName">First Name (A-Z)</option>
                <option value="lastName">Last Name (A-Z)</option>
                <option value="date">Created Date (Newest)</option>
                <option value="lastUpdated">Last Updated (Newest)</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="member-records-list-error">{error}</div>}

          {/* Records Count */}
          <div className="member-records-list-count">
            {sortedRecords.length === 0
              ? 'No member records found'
              : `Showing ${sortedRecords.length} ${
                  sortedRecords.length === 1 ? 'record' : 'records'
                }`}
          </div>

          {/* Records List */}
          <div className="member-records-list-items">
            {sortedRecords.length === 0 ? (
              <div className="member-records-list-empty">
                <p>No member records found for this unit.</p>
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                  Member records are created when you click the 📋 button next to a person's
                  name in the visit form.
                </p>
              </div>
            ) : (
              sortedRecords.map((record) => (
                <div
                  key={record.id}
                  className="member-records-list-item"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="member-records-list-item-main">
                    <div className="member-records-list-item-name">
                      {record.firstName || record.lastName
                        ? `${record.firstName || ''} ${record.lastName || ''}`.trim()
                        : record.personName || 'Unknown'}
                    </div>
                    <div className="member-records-list-item-details">
                      <span className="member-records-list-item-detail">
                        Age: {getAge(record)}
                      </span>
                      {record.gender && (
                        <span className="member-records-list-item-detail">
                          Gender: {record.gender}
                        </span>
                      )}
                      {record.phone && (
                        <span className="member-records-list-item-detail">
                          📞 {record.phone}
                        </span>
                      )}
                    </div>
                    {(record.school || record.workplace) && (
                      <div className="member-records-list-item-info">
                        {record.school && <span>🎓 {record.school}</span>}
                        {record.workplace && <span>💼 {record.workplace}</span>}
                      </div>
                    )}
                  </div>
                  <div className="member-records-list-item-meta">
                    <div className="member-records-list-item-date">
                      Created: {formatDate(record.createdAt)}
                    </div>
                    {record.updatedAt && (
                      <div className="member-records-list-item-date">
                        Updated: {formatDate(record.updatedAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Close Button */}
          <div className="member-records-list-actions">
            <button
              onClick={onClose}
              className="member-records-list-btn member-records-list-btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Member Record Detail Modal */}
      {selectedRecord && (
        <MemberRecord
          person={{ name: selectedRecord.personName }}
          buildingId={buildingId}
          unitNumber={unitNumber}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}
