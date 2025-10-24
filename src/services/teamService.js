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
 * @param {Object} teamData - Team information
 * @param {string} teamData.name - Team name (e.g., "Gwinnett")
 * @param {string} teamData.country - Country
 * @param {string} teamData.city - City
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created team with ID
 */
export async function createTeam(teamData, createdBy) {
  try {
    const teamRef = await addDoc(collection(db, TEAMS_COLLECTION), {
      name: teamData.name,
      country: teamData.country,
      city: teamData.city,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: teamRef.id,
      ...teamData,
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

/**
 * Get teams by country
 * @param {string} country - Country name
 * @returns {Promise<Array>} Array of teams in the country
 */
export async function getTeamsByCountry(country) {
  try {
    const teamsQuery = query(
      collection(db, TEAMS_COLLECTION),
      where('country', '==', country),
      where('isActive', '==', true),
      orderBy('city')
    );
    const snapshot = await getDocs(teamsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting teams by country:', error);
    throw error;
  }
}
