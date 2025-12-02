/**
 * Route Service
 * Handles CRUD operations for routes within communities
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
import { validateName, ValidationError } from '../utils/validation.js';

const ROUTES_COLLECTION = 'routes';

/**
 * Create a new route
 * @param {string} routeName - Route name
 * @param {string} communityId - Community ID this route belongs to
 * @param {string} teamId - Team ID this route belongs to
 * @param {string} createdBy - User ID of creator
 * @param {string} routeLeaderId - User ID of the route leader (optional)
 * @returns {Promise<Object>} Created route with ID
 */
export async function createRoute(
  routeName,
  communityId,
  teamId,
  createdBy,
  routeLeaderId = null
) {
  try {
    // Validate and sanitize the route name
    const sanitizedName = validateName(routeName, {
      required: true,
      minLength: 1,
      maxLength: 100,
      fieldName: 'Route name',
    });

    // Check for the duplicated route name within the same community
    const duplicateQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('communityId', '==', communityId),
      where('name', '==', sanitizedName),
      where('isActive', '==', true)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      throw new Error(
        `A route with the name "${sanitizedName}" already exists in this community`
      );
    }

    const routeRef = await addDoc(collection(db, ROUTES_COLLECTION), {
      name: sanitizedName,
      communityId,
      teamId,
      routeLeaderId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: routeRef.id,
      name: sanitizedName,
      communityId,
      teamId,
      routeLeaderId,
    };
  } catch (error) {
    console.error('Error creating route:', error);
    if (error instanceof ValidationError) {
      throw new Error(`Invalid route data: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get a single route by ID
 * @param {string} routeId - Route ID
 * @returns {Promise<Object|null>} Route data or null if not found
 */
export async function getRoute(routeId) {
  try {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    const routeSnap = await getDoc(routeRef);

    if (routeSnap.exists()) {
      return {
        id: routeSnap.id,
        ...routeSnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting route:', error);
    throw error;
  }
}

/**
 * Get all routes for a specific community
 * @param {string} communityId - Community ID
 * @param {boolean} preferCache - If true, try cache first for faster offline performance
 * @returns {Promise<Array>} Array of routes in the community
 */
export async function getRoutesByCommunity(communityId, preferCache = false) {
  try {
    const routesQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('communityId', '==', communityId),
      where('isActive', '==', true),
      orderBy('name')
    );

    // Use cache-first when offline for instant response
    const options = preferCache ? { source: 'cache' } : {};
    const snapshot = await getDocs(routesQuery, options);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If cache fetch fails, fall back to default (network + cache)
    if (error.code === 'unavailable' && preferCache) {
      console.log('Cache miss for routes, falling back to network');
      const snapshot = await getDocs(routesQuery);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    console.error('Error getting routes by community:', error);
    throw error;
  }
}

/**
 * Get all routes for a specific team
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of routes in the team
 */
export async function getRoutesByTeam(teamId) {
  try {
    const routesQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(routesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting routes by team:', error);
    throw error;
  }
}

/**
 * Get routes assigned to a specific route leader
 * @param {string} routeLeaderId - User ID of the route leader
 * @returns {Promise<Array>} Array of routes assigned to the route leader
 */
export async function getRoutesByLeader(routeLeaderId) {
  try {
    const routesQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('routeLeaderId', '==', routeLeaderId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(routesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting routes by leader:', error);
    throw error;
  }
}

/**
 * Get all routes (for super admins)
 * @returns {Promise<Array>} Array of all routes
 */
export async function getAllRoutes() {
  try {
    const routesQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(routesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting all routes:', error);
    throw error;
  }
}

/**
 * Update route information
 * @param {string} routeId - Route ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateRoute(routeId, updates) {
  try {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    await updateDoc(routeRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating route:', error);
    throw error;
  }
}

/**
 * Assign a route leader to a route
 * Updates BOTH the route document and the user document to maintain data consistency
 * @param {string} routeId - Route ID
 * @param {string} routeLeaderId - User ID of the route leader (or null to unassign)
 * @returns {Promise<void>}
 */
export async function assignRouteLeader(routeId, routeLeaderId) {
  try {
    // First, get the current route to find the old route leader
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    const routeSnap = await getDoc(routeRef);
    const oldRouteLeaderId = routeSnap.exists()
      ? routeSnap.data().routeLeaderId
      : null;

    // Update the route document with new route leader
    await updateDoc(routeRef, {
      routeLeaderId,
      updatedAt: serverTimestamp(),
    });

    // Update the old route leader's routeId to null (if they exist)
    if (oldRouteLeaderId && oldRouteLeaderId !== routeLeaderId) {
      const oldLeaderRef = doc(db, 'users', oldRouteLeaderId);
      await updateDoc(oldLeaderRef, {
        routeId: null,
        updatedAt: serverTimestamp(),
      });
    }

    // Update the new route leader's routeId (if they exist)
    if (routeLeaderId) {
      const newLeaderRef = doc(db, 'users', routeLeaderId);
      await updateDoc(newLeaderRef, {
        routeId: routeId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error assigning route leader:', error);
    throw error;
  }
}

/**
 * Soft delete a route and cascade to related entities
 * This will soft delete:
 * - The route itself
 * - All buildings in the route
 * - Updates any route leaders assigned to this route (sets their routeId to null)
 * - All visits in those buildings (hard delete with batch operations)
 * Uses batch operations for all-or-nothing deletion
 * @param {string} routeId - Route ID
 * @param {boolean} skipCascade - If true, only delete the route without cascading (default: false)
 * @returns {Promise<void>}
 */
export async function deleteRoute(routeId, skipCascade = false) {
  try {
    // First, get the route to check for route leader
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    const routeSnap = await getDoc(routeRef);

    if (!routeSnap.exists()) {
      throw new Error('Route not found');
    }

    const routeData = routeSnap.data();
    const routeLeaderId = routeData.routeLeaderId;

    if (!skipCascade) {
      // Import building service and batch helpers
      const { getBuildingsByRoute } = await import('./buildingService.js');
      const { batchUpdate, batchDelete } = await import('./batchHelpers.js');

      // Get all buildings in this route
      const buildings = await getBuildingsByRoute(routeId);

      if (buildings.length > 0) {
        // Collect all document references to delete (buildings + their visits)
        const docRefsToDelete = [];
        const BUILDINGS_COLLECTION = 'buildings';
        const VISITS_SUBCOLLECTION = 'visits';

        // For each building, get its visits and add all refs to delete list
        for (const building of buildings) {
          // Get visits for this building
          const visitsRef = collection(
            db,
            BUILDINGS_COLLECTION,
            building.id,
            VISITS_SUBCOLLECTION
          );
          const visitsSnapshot = await getDocs(visitsRef);

          // Add all visit document references
          visitsSnapshot.docs.forEach((visitDoc) => {
            docRefsToDelete.push(
              doc(db, BUILDINGS_COLLECTION, building.id, VISITS_SUBCOLLECTION, visitDoc.id)
            );
          });

          // Add the building document reference
          docRefsToDelete.push(doc(db, BUILDINGS_COLLECTION, building.id));
        }

        // Perform batch delete for all buildings and visits
        const deleteResult = await batchDelete(docRefsToDelete);

        console.log(
          `✅ Cascade deleted ${buildings.length} buildings with ${deleteResult.deletedCount - buildings.length} visits from route ${routeId} using ${deleteResult.batchCount} batch(es)`
        );
      }

      // Clear the route assignment from the route leader's user profile
      if (routeLeaderId) {
        const updates = [
          {
            ref: doc(db, 'users', routeLeaderId),
            data: {
              routeId: null,
              updatedAt: serverTimestamp(),
            },
          },
        ];

        await batchUpdate(updates);
        console.log(
          `✅ Cleared route assignment for route leader ${routeLeaderId}`
        );
      }
    }

    // Finally, soft delete the route itself
    await updateDoc(routeRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      // Clear the route leader reference to avoid orphaned references
      routeLeaderId: null,
    });
  } catch (error) {
    console.error('Error deleting route with cascade:', error);
    throw error;
  }
}
