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
 * Soft delete a team and cascade to related entities
 * This will soft delete:
 * - The team itself
 * - All communities in the team
 * - All routes in those communities
 * - All buildings in those routes
 * - Update all users in the team (sets their teamId to null and disables accounts)
 * - Preserve visits (they will remain as historical records)
 * @param {string} teamId - Team ID
 * @param {boolean} skipCascade - If true, only delete the team without cascading (default: false)
 * @returns {Promise<void>}
 */
export async function deleteTeam(teamId, skipCascade = false) {
  try {
    if (!skipCascade) {
      // Import community service to handle cascade
      const { getCommunitiesByTeam, deleteCommunity } = await import('./communityService.js');

      // Get all communities in this team
      const communities = await getCommunitiesByTeam(teamId);

      // Delete each community (which will cascade to routes and buildings)
      const communityDeletePromises = communities.map(community =>
        deleteCommunity(community.id, false) // false = with cascade
      );

      await Promise.all(communityDeletePromises);

      console.log(`Cascade deleted ${communities.length} communities from team ${teamId}`);

      // Handle users in this team
      const usersQuery = query(
        collection(db, 'users'),
        where('teamId', '==', teamId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      // Clear team assignment from all users and deactivate them
      const userUpdatePromises = usersSnapshot.docs.map(userDoc => {
        const userRef = doc(db, 'users', userDoc.id);
        return updateDoc(userRef, {
          teamId: null,
          routeId: null, // Also clear route assignment
          isActive: false, // Deactivate the user account
          updatedAt: serverTimestamp(),
          deactivatedReason: 'Team deleted',
        });
      });

      await Promise.all(userUpdatePromises);

      console.log(`Deactivated ${usersSnapshot.docs.length} users from team ${teamId}`);
    }

    // Finally, soft delete the team itself
    const teamRef = doc(db, TEAMS_COLLECTION, teamId);
    await updateDoc(teamRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting team with cascade:', error);
    throw error;
  }
}
