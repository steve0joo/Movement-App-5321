import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMemberRecord, saveMemberRecord } from '../services/memberRecordService';
import './MemberRecord.css';

export default function MemberRecord({ person, buildingId, unitNumber, onClose }) {
  const { currentUser } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load member record on mount
  useEffect(() => {
    async function loadRecord() {
      try {
        setLoading(true);
        const data = await getMemberRecord(person.name, buildingId, unitNumber);
        setRecord(data);
      } catch (err) {
        console.error('Error loading member record:', err);
        setError('Failed to load member record');
      } finally {
        setLoading(false);
      }
    }

    if (person?.name && buildingId && unitNumber) {
      loadRecord();
    }
  }, [person, buildingId, unitNumber]);

  const handleChange = (field, value) => {
    setRecord((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultiSelectChange = (field, value) => {
    setRecord((prev) => {
      const currentValues = prev[field] || [];
      if (currentValues.includes(value)) {
        return { ...prev, [field]: currentValues.filter((v) => v !== value) };
      } else {
        return { ...prev, [field]: [...currentValues, value] };
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      await saveMemberRecord(record.id, record, currentUser.uid);
      setSuccessMessage('Member record saved successfully!');

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error saving member record:', err);
      setError('Failed to save member record');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="member-record-overlay">
        <div className="member-record-container">
          <div className="member-record-loading">Loading member record...</div>
        </div>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  return (
    <div className="member-record-overlay">
      <div className="member-record-container">
        {/* Header */}
        <div className="member-record-header">
          <h2 className="member-record-title">Member Record: {person.name}</h2>
          <button
            className="member-record-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form className="member-record-form" onSubmit={(e) => e.preventDefault()}>
          {/* Level 1: Basic Information */}
          <div className="member-record-section">
            <h3 className="member-record-section-title">Level 1: Basic Information</h3>

            <div className="member-record-field">
              <label>First Name</label>
              <input
                type="text"
                value={record.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Last Name</label>
              <input
                type="text"
                value={record.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Gender</label>
              <select
                value={record.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>Date of Birth</label>
              <input
                type="date"
                value={record.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Age</label>
              <input
                type="number"
                value={record.age}
                onChange={(e) => handleChange('age', e.target.value)}
                className="member-record-input"
                min="0"
                max="150"
              />
            </div>

            <div className="member-record-field">
              <label>Role</label>
              <input
                type="text"
                value={record.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="member-record-input"
                placeholder="e.g., Parent, Student, Guardian"
              />
            </div>
          </div>

          {/* Level 2: Contact & Education */}
          <div className="member-record-section">
            <h3 className="member-record-section-title">Level 2: Contact & Education</h3>

            <div className="member-record-field">
              <label>What School do You Attend?</label>
              <input
                type="text"
                value={record.school}
                onChange={(e) => handleChange('school', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>What Grade Are You In?</label>
              <input
                type="text"
                value={record.grade}
                onChange={(e) => handleChange('grade', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>High School Graduation Year</label>
              <input
                type="number"
                value={record.highSchoolGradYear}
                onChange={(e) => handleChange('highSchoolGradYear', e.target.value)}
                className="member-record-input"
                min="1900"
                max="2100"
              />
            </div>

            <div className="member-record-field">
              <label>Last Grade Completed</label>
              <input
                type="text"
                value={record.lastGradeCompleted}
                onChange={(e) => handleChange('lastGradeCompleted', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>College Graduation Year</label>
              <input
                type="number"
                value={record.collegeGradYear}
                onChange={(e) => handleChange('collegeGradYear', e.target.value)}
                className="member-record-input"
                min="1900"
                max="2100"
              />
            </div>

            <div className="member-record-field">
              <label>Where Do You Work?</label>
              <input
                type="text"
                value={record.workplace}
                onChange={(e) => handleChange('workplace', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>What Do You Do?</label>
              <input
                type="text"
                value={record.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Address</label>
              <input
                type="text"
                value={record.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Phone</label>
              <input
                type="tel"
                value={record.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Email</label>
              <input
                type="email"
                value={record.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Emergency Contact Name</label>
              <input
                type="text"
                value={record.emergencyContactName}
                onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Emergency Contact Phone</label>
              <input
                type="tel"
                value={record.emergencyContactPhone}
                onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Birth Country</label>
              <input
                type="text"
                value={record.birthCountry}
                onChange={(e) => handleChange('birthCountry', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Ethnicity</label>
              <input
                type="text"
                value={record.ethnicity}
                onChange={(e) => handleChange('ethnicity', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Lives With</label>
              <div className="member-record-checkbox-group">
                {['Father', 'Mother', 'Guardians', 'Friends', 'Siblings', 'Spouse', 'Children', 'Other'].map((option) => (
                  <label key={option} className="member-record-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(record.livesWith || []).includes(option)}
                      onChange={() => handleMultiSelectChange('livesWith', option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Level 3: Detailed Information */}
          <div className="member-record-section">
            <h3 className="member-record-section-title">Level 3: Detailed Information</h3>

            <div className="member-record-field">
              <label>Income</label>
              <input
                type="text"
                value={record.income}
                onChange={(e) => handleChange('income', e.target.value)}
                className="member-record-input"
                placeholder="e.g., $30,000-$50,000"
              />
            </div>

            <div className="member-record-field">
              <label>English Fluency</label>
              <select
                value={record.englishFluency}
                onChange={(e) => handleChange('englishFluency', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Fluent">Fluent</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Basic">Basic</option>
                <option value="None">None</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>ESL Interest?</label>
              <select
                value={record.eslInterest}
                onChange={(e) => handleChange('eslInterest', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Maybe">Maybe</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>Immigration Status</label>
              <input
                type="text"
                value={record.immigrationStatus}
                onChange={(e) => handleChange('immigrationStatus', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Are You Using Any Government Programs for Assistance?</label>
              <div className="member-record-checkbox-group">
                {['Food assistance', 'Housing assistance', 'Medical insurance', 'Other'].map((option) => (
                  <label key={option} className="member-record-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(record.governmentPrograms || []).includes(option)}
                      onChange={() => handleMultiSelectChange('governmentPrograms', option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="member-record-field">
              <label>Do You Have Medical Insurance?</label>
              <select
                value={record.hasMedicalInsurance}
                onChange={(e) => handleChange('hasMedicalInsurance', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>When Did You Arrive to the Country?</label>
              <input
                type="date"
                value={record.arrivalDate}
                onChange={(e) => handleChange('arrivalDate', e.target.value)}
                className="member-record-input"
              />
            </div>

            <div className="member-record-field">
              <label>Have You Been a Victim of Crime in Your Neighborhood?</label>
              <select
                value={record.crimeVictim}
                onChange={(e) => handleChange('crimeVictim', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>Do You Buy Things on Credit?</label>
              <select
                value={record.buyOnCredit}
                onChange={(e) => handleChange('buyOnCredit', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Sometimes">Sometimes</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>Are You Late Paying Bills?</label>
              <select
                value={record.latePayingBills}
                onChange={(e) => handleChange('latePayingBills', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Sometimes">Sometimes</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>Do You Have Savings for Emergencies?</label>
              <select
                value={record.emergencySavings}
                onChange={(e) => handleChange('emergencySavings', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Some">Some</option>
              </select>
            </div>

            <div className="member-record-field">
              <label>How Satisfied Are You With Your Job/Where You Work?</label>
              <select
                value={record.jobSatisfaction}
                onChange={(e) => handleChange('jobSatisfaction', e.target.value)}
                className="member-record-input"
              >
                <option value="">Select...</option>
                <option value="Very satisfied">Very satisfied</option>
                <option value="Satisfied">Satisfied</option>
                <option value="Neutral">Neutral</option>
                <option value="Dissatisfied">Dissatisfied</option>
                <option value="Very dissatisfied">Very dissatisfied</option>
                <option value="Not applicable">Not applicable</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          {error && <div className="member-record-error">{error}</div>}
          {successMessage && <div className="member-record-success">{successMessage}</div>}

          {/* Actions */}
          <div className="member-record-actions">
            <button
              type="button"
              onClick={onClose}
              className="member-record-btn member-record-btn-secondary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="member-record-btn member-record-btn-primary"
            >
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
