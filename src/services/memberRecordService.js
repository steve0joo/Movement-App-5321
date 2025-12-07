import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  handleOfflineRead,
  handleOfflineWrite,
  handleOfflineQuery,
} from '../utils/offlineErrorHandler';

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

  // Default empty record structure
  const emptyRecord = {
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

  return handleOfflineRead(async () => {
    const recordRef = doc(db, 'memberRecords', recordId);
    const recordSnap = await getDoc(recordRef);

    if (recordSnap.exists()) {
      return { id: recordSnap.id, ...recordSnap.data() };
    }

    return emptyRecord;
  }, emptyRecord);
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

  const optimisticData = {
    id: recordId,
    ...data,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  return handleOfflineWrite(async () => {
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
  }, optimisticData);
}

/**
 * Get all member records for a specific building and unit
 * @param {string} buildingId - Building ID
 * @param {string} unitNumber - Unit number
 * @returns {Promise<Array>} Array of member records
 */
export async function getMemberRecordsByUnit(buildingId, unitNumber) {
  if (!buildingId || !unitNumber) {
    throw new Error('Building ID and unit number are required');
  }

  return handleOfflineQuery(async () => {
    const recordsRef = collection(db, 'memberRecords');
    const q = query(
      recordsRef,
      where('buildingId', '==', buildingId),
      where('unitNumber', '==', unitNumber)
    );

    const querySnapshot = await getDocs(q);
    const records = [];

    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return records;
  });
}

/**
 * Get all member records for a specific building (all units)
 * @param {string} buildingId - Building ID
 * @returns {Promise<Array>} Array of the member records
 */
export async function getMemberRecordsByBuilding(buildingId) {
  if (!buildingId) {
    throw new Error('Building ID is required');
  }

  return handleOfflineQuery(async () => {
    const recordsRef = collection(db, 'memberRecords');
    const q = query(recordsRef, where('buildingId', '==', buildingId));

    const querySnapshot = await getDocs(q);
    const records = [];

    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return records;
  });
}
