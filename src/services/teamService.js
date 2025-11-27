/**
 * Team Service
 * Handles CRUD operations for teams (geographic locations: country/city)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const TEAMS_COLLECTION = 'teams';

/**
 * Create a new team
 * @param {string} teamName - Team name (e.g., "Gwinnett")
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created team with ID
 */
export async function createTeam(teamName, createdBy) {
  try {
    // Check for the duplicated team name
    const duplicateQuery = query(
      collection(db, TEAMS_COLLECTION),
      where('name', '==', teamName),
      where('isActive', '==', true)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      throw new Error(`A team with the name "${teamName}" already exists`);
    }

    const teamRef = await addDoc(collection(db, TEAMS_COLLECTION), {
      name: teamName,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: teamRef.id,
      name: teamName,
    };
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
}

/**
 * Get a single team by ID
 * @param {string} teamId - Team ID
 * @returns {Promise<Object|null>} Team data or null if not found
 */
export async function getTeam(teamId) {
  try {
    const teamRef = doc(db, TEAMS_COLLECTION, teamId);
    const teamSnap = await getDoc(teamRef);

    if (teamSnap.exists()) {
      return {
        id: teamSnap.id,
        ...teamSnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting team:', error);
    throw error;
  }
}

/**
 * Get all teams
 * @returns {Promise<Array>} Array of all teams
 */
export async function getAllTeams() {
  try {
    const teamsQuery = query(
      collection(db, TEAMS_COLLECTION),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(teamsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting all teams:', error);
    throw error;
  }
}

/**
 * Update team information
 * @param {string} teamId - Team ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateTeam(teamId, updates) {
  try {
    const teamRef = doc(db, TEAMS_COLLECTION, teamId);
    await updateDoc(teamRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating team:', error);
    throw error;
  }
}

/**
 * Soft delete a team (set isActive to false)
 * @param {string} teamId - Team ID
 * @returns {Promise<void>}
 */
export async function deleteTeam(teamId) {
  try {
    const teamRef = doc(db, TEAMS_COLLECTION, teamId);
    await updateDoc(teamRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
}
