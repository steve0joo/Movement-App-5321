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
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

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
export async function createRoute(routeName, communityId, teamId, createdBy, routeLeaderId = null) {
  try {
    const routeRef = await addDoc(collection(db, ROUTES_COLLECTION), {
      name: routeName,
      communityId,
      teamId,
      routeLeaderId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    return {
      id: routeRef.id,
      name: routeName,
      communityId,
      teamId,
      routeLeaderId,
    };
  } catch (error) {
    console.error('Error creating route:', error);
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
 * @returns {Promise<Array>} Array of routes in the community
 */
export async function getRoutesByCommunity(communityId) {
  try {
    const routesQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('communityId', '==', communityId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(routesQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
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
    const oldRouteLeaderId = routeSnap.exists() ? routeSnap.data().routeLeaderId : null;

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
 * Soft delete a route (set isActive to false)
 * @param {string} routeId - Route ID
 * @returns {Promise<void>}
 */
export async function deleteRoute(routeId) {
  try {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    await updateDoc(routeRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting route:', error);
    throw error;
  }
}
