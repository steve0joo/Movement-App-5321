import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Member Record Service
 * Manage the extended profile information for people visited
 */

/**
 * Get or create a member record for a person
 * @param {string} personName - Name of the person
 * @param {string} buildingId - Building ID
 * @param {string} unitNumber - Unit number
 * @returns {Promise<Object>} Member record with id and data
 */
export async function getMemberRecord(personName, buildingId, unitNumber) {
  if (!personName || !buildingId || !unitNumber) {
    throw new Error('Person name, building ID, and unit number are required');
  }

  // Create a unique ID based on building, unit, and name
  const recordId = `${buildingId}_${unitNumber}_${personName
    .toLowerCase()
    .replace(/\s+/g, '_')}`;
  const recordRef = doc(db, 'memberRecords', recordId);

  const recordSnap = await getDoc(recordRef);

  if (recordSnap.exists()) {
    return { id: recordSnap.id, ...recordSnap.data() };
  }

  // Return the empty record structure if doesn't exist
  return {
    id: recordId,
    personName,
    buildingId,
    unitNumber,
    // Level 1 - Basic Information
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    age: '',
    role: '',

    // Level 2 - Contact & Education
    school: '',
    grade: '',
    highSchoolGradYear: '',
    lastGradeCompleted: '',
    collegeGradYear: '',
    workplace: '',
    occupation: '',
    address: '',
    phone: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    birthCountry: '',
    ethnicity: '',
    livesWith: [],

    // Level 3 - Detailed Information
    income: '',
    englishFluency: '',
    eslInterest: '',
    immigrationStatus: '',
    governmentPrograms: [],
    hasMedicalInsurance: '',
    arrivalDate: '',
    crimeVictim: '',
    buyOnCredit: '',
    latePayingBills: '',
    emergencySavings: '',
    jobSatisfaction: '',

    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Save member record
 * @param {string} recordId - Record ID
 * @param {Object} data - Member record data
 * @param {string} userId - User ID making the update
 * @returns {Promise<Object>} Updated record
 */
export async function saveMemberRecord(recordId, data, userId) {
  if (!recordId) {
    throw new Error('Record ID is required');
  }

  const recordRef = doc(db, 'memberRecords', recordId);
  const recordSnap = await getDoc(recordRef);

  const now = serverTimestamp();

  if (recordSnap.exists()) {
    // Update existing record
    await updateDoc(recordRef, {
      ...data,
      updatedAt: now,
      updatedBy: userId,
    });
  } else {
    // Create new record
    await setDoc(recordRef, {
      ...data,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    });
  }

  const updatedSnap = await getDoc(recordRef);
  return { id: updatedSnap.id, ...updatedSnap.data() };
}
