/**
 * Community Involvement Service
 * Handles CRUD operations for follow-up types and current involvement options
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const FOLLOW_UPS_COLLECTION = 'followUps';
const INVOLVEMENTS_COLLECTION = 'currentInvolvements';

/**
 * Create a new follow-up option
 * @param {string} name - Follow-up name
 * @param {string} teamId - Team ID
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created follow-up with ID
 */
export async function createFollowUp(name, teamId, createdBy) {
  try {
    // Check for duplicate
    const duplicateQuery = query(
      collection(db, FOLLOW_UPS_COLLECTION),
      where('name', '==', name),
      where('teamId', '==', teamId),
      where('isActive', '==', true)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      throw new Error(`A follow-up option with the name "${name}" already exists for this team`);
    }

    const followUpRef = await addDoc(collection(db, FOLLOW_UPS_COLLECTION), {
      name,
      teamId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: followUpRef.id,
      name,
      teamId,
    };
  } catch (error) {
    console.error('Error creating follow-up:', error);
    throw error;
  }
}

/**
 * Get all follow-up options for a team
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of follow-up options
 */
export async function getFollowUpsByTeam(teamId) {
  try {
    const followUpsQuery = query(
      collection(db, FOLLOW_UPS_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true)
      // orderBy('name') // Remove this temporarily
    );
    const snapshot = await getDocs(followUpsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })).sort((a, b) => a.name.localeCompare(b.name)); // Sort in JS instead
  } catch (error) {
    console.error('Error getting follow-ups:', error);
    throw error;
  }
}

/**
 * Update a follow-up option
 * @param {string} followUpId - Follow-up ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateFollowUp(followUpId, updates) {
  try {
    const followUpRef = doc(db, FOLLOW_UPS_COLLECTION, followUpId);
    await updateDoc(followUpRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating follow-up:', error);
    throw error;
  }
}

/**
 * Soft delete a follow-up option
 * @param {string} followUpId - Follow-up ID
 * @returns {Promise<void>}
 */
export async function deleteFollowUp(followUpId) {
  try {
    const followUpRef = doc(db, FOLLOW_UPS_COLLECTION, followUpId);
    await updateDoc(followUpRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting follow-up:', error);
    throw error;
  }
}

/**
 * Create a new involvement option
 * @param {string} name - Involvement name
 * @param {string} teamId - Team ID
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created involvement with ID
 */
export async function createInvolvement(name, teamId, createdBy) {
  try {
    // Check for duplicate
    const duplicateQuery = query(
      collection(db, INVOLVEMENTS_COLLECTION),
      where('name', '==', name),
      where('teamId', '==', teamId),
      where('isActive', '==', true)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      throw new Error(`An involvement option with the name "${name}" already exists for this team`);
    }

    const involvementRef = await addDoc(collection(db, INVOLVEMENTS_COLLECTION), {
      name,
      teamId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: involvementRef.id,
      name,
      teamId,
    };
  } catch (error) {
    console.error('Error creating involvement:', error);
    throw error;
  }
}

/**
 * Get all involvement options for a team
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of involvement options
 */
export async function getInvolvementsByTeam(teamId) {
  try {
    const involvementsQuery = query(
      collection(db, INVOLVEMENTS_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true)
      // orderBy('name') // Remove this temporarily
    );
    const snapshot = await getDocs(involvementsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })).sort((a, b) => a.name.localeCompare(b.name)); // Sort in JS instead
  } catch (error) {
    console.error('Error getting involvements:', error);
    throw error;
  }
}

/**
 * Update an involvement option
 * @param {string} involvementId - Involvement ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateInvolvement(involvementId, updates) {
  try {
    const involvementRef = doc(db, INVOLVEMENTS_COLLECTION, involvementId);
    await updateDoc(involvementRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating involvement:', error);
    throw error;
  }
}

/**
 * Soft delete an involvement option
 * @param {string} involvementId - Involvement ID
 * @returns {Promise<void>}
 */
export async function deleteInvolvement(involvementId) {
  try {
    const involvementRef = doc(db, INVOLVEMENTS_COLLECTION, involvementId);
    await updateDoc(involvementRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting involvement:', error);
    throw error;
  }
}