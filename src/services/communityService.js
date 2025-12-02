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
import {
  handleOfflineWrite,
  handleOfflineQuery,
} from '../utils/offlineErrorHandler.js';

const COMMUNITIES_COLLECTION = 'communities';

/**
 * Create a new community
 * @param {string} communityName - Community name
 * @param {string} teamId - Team ID this community belongs to
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created community with ID
 */
export async function createCommunity(communityName, teamId, createdBy) {
  // Validate and sanitize community name first (before any async operations)
  const sanitizedName = validateName(communityName, {
    required: true,
    minLength: 1,
    maxLength: 100,
    fieldName: 'Community name'
  });

  // Generate temporary ID for offline optimistic response
  const tempId = `temp_community_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const optimisticData = {
    id: tempId,
    name: sanitizedName,
    teamId,
    createdBy,
    createdAt: new Date(),
    isActive: true,
  };

  try {
    return await handleOfflineWrite(async () => {
      // Check for duplicate community name within the same team
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
    }, optimisticData);
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
 * @param {boolean} preferCache - If true, try cache first for faster offline performance
 * @returns {Promise<Array>} Array of communities in the team
 */
export async function getCommunitiesByTeam(teamId, preferCache = false) {
  try {
    const communitiesQuery = query(
      collection(db, COMMUNITIES_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('name')
    );

    // Use cache-first when offline for instant response
    const options = preferCache ? { source: 'cache' } : {};
    const snapshot = await getDocs(communitiesQuery, options);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If cache fetch fails, fall back to default (network + cache)
    if (error.code === 'unavailable' && preferCache) {
      console.log('Cache miss for communities, falling back to network');
      const snapshot = await getDocs(communitiesQuery);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
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
 * - All visits in those buildings (hard delete with batch operations)
 * Uses batch operations forvall-or-nothing deletion
 * @param {string} communityId - Community ID
 * @param {boolean} skipCascade - If true, only deletes the community without cascading (default: false)
 * @returns {Promise<void>}
 */
export async function deleteCommunity(communityId, skipCascade = false) {
  try {
    if (!skipCascade) {
      // Import route and building services and batch helpers
      const { getRoutesByCommunity } = await import('./routeService.js');
      const { getBuildingsByRoute } = await import('./buildingService.js');
      const { batchDelete, batchUpdate } = await import('./batchHelpers.js');

      // Get all routes in this community
      const routes = await getRoutesByCommunity(communityId);

      if (routes.length > 0) {
        // Collect all document references to delete (routes + buildings + visits)
        const docRefsToDelete = [];
        const userUpdates = [];
        const ROUTES_COLLECTION = 'routes';
        const BUILDINGS_COLLECTION = 'buildings';
        const VISITS_SUBCOLLECTION = 'visits';

        let totalBuildings = 0;
        let totalVisits = 0;

        // For each route, get buildings and visits
        for (const route of routes) {
          // Collect route leader updates if needed
          if (route.routeLeaderId) {
            userUpdates.push({
              ref: doc(db, 'users', route.routeLeaderId),
              data: {
                routeId: null,
                updatedAt: serverTimestamp(),
              },
            });
          }

          // Get all buildings in this route
          const buildings = await getBuildingsByRoute(route.id);
          totalBuildings += buildings.length;

          // For each building, get its visits
          for (const building of buildings) {
            const visitsRef = collection(
              db,
              BUILDINGS_COLLECTION,
              building.id,
              VISITS_SUBCOLLECTION
            );
            const visitsSnapshot = await getDocs(visitsRef);
            totalVisits += visitsSnapshot.docs.length;

            // Add all visit document references
            visitsSnapshot.docs.forEach((visitDoc) => {
              docRefsToDelete.push(
                doc(db, BUILDINGS_COLLECTION, building.id, VISITS_SUBCOLLECTION, visitDoc.id)
              );
            });

            // Add the building document reference
            docRefsToDelete.push(doc(db, BUILDINGS_COLLECTION, building.id));
          }

          // Add the route document reference
          docRefsToDelete.push(doc(db, ROUTES_COLLECTION, route.id));
        }

        // Perform batch delete for all routes, buildings, and visits
        const deleteResult = await batchDelete(docRefsToDelete);

        console.log(
          `✅ Cascade deleted ${routes.length} routes, ${totalBuildings} buildings, and ${totalVisits} visits from community ${communityId} using ${deleteResult.batchCount} batch(es)`
        );

        // Update user profiles to clear route assignments (separate batch)
        if (userUpdates.length > 0) {
          await batchUpdate(userUpdates);
          console.log(`✅ Cleared route assignments for ${userUpdates.length} route leaders`);
        }
      }
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
