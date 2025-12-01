/**
 * Community Service
 * Handles CRUD operations for communities (neighborhoods, apartment complexes, etc.)
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
import {
  validateName,
  ValidationError,
} from '../utils/validation.js';

const COMMUNITIES_COLLECTION = 'communities';

/**
 * Create a new community
 * @param {string} communityName - Community name
 * @param {string} teamId - Team ID this community belongs to
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created community with ID
 */
export async function createCommunity(communityName, teamId, createdBy) {
  try {
    // Validate and sanitize community name
    const sanitizedName = validateName(communityName, {
      required: true,
      minLength: 1,
      maxLength: 100,
      fieldName: 'Community name'
    });

    // Check for the duplicated community name within the same team
    const duplicateQuery = query(
      collection(db, COMMUNITIES_COLLECTION),
      where('teamId', '==', teamId),
      where('name', '==', sanitizedName),
      where('isActive', '==', true)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      throw new Error(
        `A community with the name "${sanitizedName}" already exists in this team`
      );
    }

    const communityRef = await addDoc(collection(db, COMMUNITIES_COLLECTION), {
      name: sanitizedName,
      teamId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: communityRef.id,
      name: sanitizedName,
      teamId,
    };
  } catch (error) {
    console.error('Error creating community:', error);
    if (error instanceof ValidationError) {
      throw new Error(`Invalid community data: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get a single community by ID
 * @param {string} communityId - Community ID
 * @returns {Promise<Object|null>} Community data or null if not found
 */
export async function getCommunity(communityId) {
  try {
    const communityRef = doc(db, COMMUNITIES_COLLECTION, communityId);
    const communitySnap = await getDoc(communityRef);

    if (communitySnap.exists()) {
      return {
        id: communitySnap.id,
        ...communitySnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting community:', error);
    throw error;
  }
}

/**
 * Get all communities for a specific team
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of communities in the team
 */
export async function getCommunitiesByTeam(teamId) {
  try {
    const communitiesQuery = query(
      collection(db, COMMUNITIES_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(communitiesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting communities by team:', error);
    throw error;
  }
}

/**
 * Get all communities (for super admins)
 * @returns {Promise<Array>} Array of all communities
 */
export async function getAllCommunities() {
  try {
    const communitiesQuery = query(
      collection(db, COMMUNITIES_COLLECTION),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(communitiesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting all communities:', error);
    throw error;
  }
}

/**
 * Update community information
 * @param {string} communityId - Community ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateCommunity(communityId, updates) {
  try {
    const communityRef = doc(db, COMMUNITIES_COLLECTION, communityId);
    await updateDoc(communityRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating community:', error);
    throw error;
  }
}

/**
 * Soft delete a community and cascade to related entities
 * This will soft delete:
 * - The community itself
 * - All routes in the community
 * - All buildings in those routes
 * - Preserves visits (they remain as historical records)
 * @param {string} communityId - Community ID
 * @param {boolean} skipCascade - If true, only deletes the community without cascading (default: false)
 * @returns {Promise<void>}
 */
export async function deleteCommunity(communityId, skipCascade = false) {
  try {
    if (!skipCascade) {
      // Import route and building services to handle cascade
      const { getRoutesByCommunity, deleteRoute } = await import('./routeService.js');

      // Get all routes in this community
      const routes = await getRoutesByCommunity(communityId);

      // Delete each route (which will cascade to buildings)
      const deletePromises = routes.map(route =>
        deleteRoute(route.id, false) // false = with cascade
      );

      await Promise.all(deletePromises);

      console.log(`Cascade deleted ${routes.length} routes from community ${communityId}`);
    }

    // Finally, soft delete the community itself
    const communityRef = doc(db, COMMUNITIES_COLLECTION, communityId);
    await updateDoc(communityRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting community with cascade:', error);
    throw error;
  }
}
