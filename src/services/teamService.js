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
 * - All visits in those buildings (hard delete with batch operations)
 * - Update all users in the team (sets their teamId to null and disables accounts)
 * Uses batch operations for all-or-nothing deletion
 * @param {string} teamId - Team ID
 * @param {boolean} skipCascade - If true, only delete the team without cascading (default: false)
 * @returns {Promise<void>}
 */
export async function deleteTeam(teamId, skipCascade = false) {
  try {
    if (!skipCascade) {
      // Import services and batch helpers
      const { getCommunitiesByTeam } = await import('./communityService.js');
      const { getRoutesByCommunity } = await import('./routeService.js');
      const { getBuildingsByRoute } = await import('./buildingService.js');
      const { batchDelete, batchUpdate } = await import('./batchHelpers.js');

      // Get all communities in this team
      const communities = await getCommunitiesByTeam(teamId);

      if (communities.length > 0) {
        // Collect all document references to delete (communities + routes + buildings + visits)
        const docRefsToDelete = [];
        const userUpdates = [];
        const COMMUNITIES_COLLECTION = 'communities';
        const ROUTES_COLLECTION = 'routes';
        const BUILDINGS_COLLECTION = 'buildings';
        const VISITS_SUBCOLLECTION = 'visits';

        let totalRoutes = 0;
        let totalBuildings = 0;
        let totalVisits = 0;

        // For each community, get routes, buildings, and visits
        for (const community of communities) {
          // Get all routes in this community
          const routes = await getRoutesByCommunity(community.id);
          totalRoutes += routes.length;

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

          // Add the community document reference
          docRefsToDelete.push(doc(db, COMMUNITIES_COLLECTION, community.id));
        }

        // Perform atomic batch delete for all entities
        const deleteResult = await batchDelete(docRefsToDelete);

        console.log(
          `✅ Cascade deleted ${communities.length} communities, ${totalRoutes} routes, ${totalBuildings} buildings, and ${totalVisits} visits from team ${teamId} using ${deleteResult.batchCount} batch(es)`
        );

        // Update user profiles to clear route assignments (separate batch)
        if (userUpdates.length > 0) {
          await batchUpdate(userUpdates);
          console.log(`✅ Cleared route assignments for ${userUpdates.length} route leaders`);
        }
      }

      // Handle users in this team (deactivate and clear team assignment)
      const usersQuery = query(
        collection(db, 'users'),
        where('teamId', '==', teamId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      if (usersSnapshot.docs.length > 0) {
        // Prepare user updates for batch operation
        const userDeactivationUpdates = usersSnapshot.docs.map(userDoc => ({
          ref: doc(db, 'users', userDoc.id),
          data: {
            teamId: null,
            routeId: null,
            isActive: false,
            updatedAt: serverTimestamp(),
            deactivatedReason: 'Team deleted',
          },
        }));

        // Use batch operations for user deactivation
        const { batchUpdate } = await import('./batchHelpers.js');
        await batchUpdate(userDeactivationUpdates);

        console.log(`✅ Deactivated ${usersSnapshot.docs.length} users from team ${teamId}`);
      }
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
