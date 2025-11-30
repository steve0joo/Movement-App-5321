/**
 * Cascade Delete Service
 * Coordinate cascade delete operations across the data hierarchy
 * Ensure data integrity when deleting parent entities
 */

import { deleteTeam } from './teamService.js';
import { deleteCommunity } from './communityService.js';
import { deleteRoute } from './routeService.js';
import { deleteBuilding } from './buildingService.js';

/**
 * Cascade delete operation summary
 * Return the information about what will be affected by a delete operation
 * @param {string} entityType - Type of entity ('team', 'community', 'route', 'building')
 * @param {string} entityId - ID of the entity to delete
 * @returns {Promise<Object>} Summary of entities that will be affected
 */
export async function getCascadeDeleteSummary(entityType, entityId) {
  const summary = {
    entityType,
    entityId,
    affectedEntities: {
      teams: 0,
      communities: 0,
      routes: 0,
      buildings: 0,
      users: 0,
      visits: 0, // Visits are preserved but counted for info
    },
    warnings: [],
  };

  try {
    switch (entityType) {
      case 'team': {
        const { getCommunitiesByTeam } = await import('./communityService.js');
        const { getRoutesByTeam } = await import('./routeService.js');
        const { getBuildingsByTeam } = await import('./buildingService.js');
        const { getUsersByTeam } = await import('./userService.js');

        summary.affectedEntities.teams = 1;

        const communities = await getCommunitiesByTeam(entityId);
        summary.affectedEntities.communities = communities.length;

        const routes = await getRoutesByTeam(entityId);
        summary.affectedEntities.routes = routes.length;

        const buildings = await getBuildingsByTeam(entityId);
        summary.affectedEntities.buildings = buildings.length;

        const users = await getUsersByTeam(entityId);
        summary.affectedEntities.users = users.length;

        if (users.length > 0) {
          summary.warnings.push(`${users.length} users will be deactivated`);
        }
        break;
      }

      case 'community': {
        const { getRoutesByCommunity } = await import('./routeService.js');
        const { getBuildingsByCommunity } = await import('./buildingService.js');

        summary.affectedEntities.communities = 1;

        const routes = await getRoutesByCommunity(entityId);
        summary.affectedEntities.routes = routes.length;

        // Get buildings for each route
        let totalBuildings = 0;
        for (const route of routes) {
          const { getBuildingsByRoute } = await import('./buildingService.js');
          const buildings = await getBuildingsByRoute(route.id);
          totalBuildings += buildings.length;
        }
        summary.affectedEntities.buildings = totalBuildings;
        break;
      }

      case 'route': {
        const { getBuildingsByRoute } = await import('./buildingService.js');
        const { getRoute } = await import('./routeService.js');

        summary.affectedEntities.routes = 1;

        const buildings = await getBuildingsByRoute(entityId);
        summary.affectedEntities.buildings = buildings.length;

        const route = await getRoute(entityId);
        if (route?.routeLeaderId) {
          summary.warnings.push('Route leader assignment will be cleared');
        }
        break;
      }

      case 'building': {
        const { getBuildingVisits } = await import('./buildingService.js');

        summary.affectedEntities.buildings = 1;

        const visits = await getBuildingVisits(entityId);
        summary.affectedEntities.visits = visits.length;

        if (visits.length > 0) {
          summary.warnings.push(`${visits.length} visits will be permanently deleted`);
        }
        break;
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    return summary;
  } catch (error) {
    console.error('Error getting cascade delete summary:', error);
    throw error;
  }
}

/**
 * Execute the cascade delete with optional confirmation
 * @param {string} entityType - Type of entity ('team', 'community', 'route', 'building')
 * @param {string} entityId - ID of the entity to delete
 * @param {boolean} skipCascade - If true, only delete the entity without cascading
 * @param {boolean} confirmed - If false, will return summary without deleting (default: false)
 * @returns {Promise<Object>} Result of the delete operation or summary if not confirmed
 */
export async function executeCascadeDelete(entityType, entityId, skipCascade = false, confirmed = false) {
  try {
    // Get summary first
    const summary = await getCascadeDeleteSummary(entityType, entityId);

    // If not confirmed, return summary for user review
    if (!confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        summary,
        message: 'Delete operation requires confirmation. Review the summary and call again with confirmed=true.',
      };
    }

    // Execute the appropriate delete operation
    let result = {
      success: false,
      entityType,
      entityId,
      deletedAt: new Date(),
      summary,
    };

    switch (entityType) {
      case 'team':
        await deleteTeam(entityId, skipCascade);
        result.success = true;
        result.message = `Team and ${summary.affectedEntities.communities} communities deleted successfully`;
        break;

      case 'community':
        await deleteCommunity(entityId, skipCascade);
        result.success = true;
        result.message = `Community and ${summary.affectedEntities.routes} routes deleted successfully`;
        break;

      case 'route':
        await deleteRoute(entityId, skipCascade);
        result.success = true;
        result.message = `Route and ${summary.affectedEntities.buildings} buildings deleted successfully`;
        break;

      case 'building':
        await deleteBuilding(entityId);
        result.success = true;
        result.message = `Building and ${summary.affectedEntities.visits} visits deleted successfully`;
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    return result;
  } catch (error) {
    console.error('Error executing cascade delete:', error);
    throw error;
  }
}

/**
 * Validate cascade delete operation
 * Check if the user has permission to delete the entity and its children
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity
 * @param {Object} currentUser - Current user object with role and teamId
 * @returns {Promise<Object>} Validation result with allowed flag and reason if denied
 */
export async function validateCascadeDelete(entityType, entityId, currentUser) {
  const validation = {
    allowed: false,
    reason: null,
    requiresSuperAdmin: false,
  };

  if (!currentUser) {
    validation.reason = 'User not authenticated';
    return validation;
  }

  const { role, teamId } = currentUser;

  try {
    switch (entityType) {
      case 'team':
        // Only super admins can delete teams
        if (role !== 'super_admin') {
          validation.reason = 'Only super admins can delete teams';
          validation.requiresSuperAdmin = true;
        } else {
          validation.allowed = true;
        }
        break;

      case 'community': {
        // Super admins can delete any community
        if (role === 'super_admin') {
          validation.allowed = true;
        } else if (role === 'team_admin') {
          // Team admins can only delete communities in their team
          const { getCommunity } = await import('./communityService.js');
          const community = await getCommunity(entityId);
          if (community?.teamId === teamId) {
            validation.allowed = true;
          } else {
            validation.reason = 'You can only delete communities in your assigned team';
          }
        } else {
          validation.reason = 'Only admins can delete communities';
        }
        break;
      }

      case 'route': {
        // Super admins can delete any route
        if (role === 'super_admin') {
          validation.allowed = true;
        } else if (role === 'team_admin') {
          // Team admins can only delete routes in their team
          const { getRoute } = await import('./routeService.js');
          const route = await getRoute(entityId);
          if (route?.teamId === teamId) {
            validation.allowed = true;
          } else {
            validation.reason = 'You can only delete routes in your assigned team';
          }
        } else {
          validation.reason = 'Only admins can delete routes';
        }
        break;
      }

      case 'building': {
        // Super admins can delete any building
        if (role === 'super_admin') {
          validation.allowed = true;
        } else if (role === 'team_admin' || role === 'route_leader') {
          // Team admins and route leaders can delete buildings in their team
          const { getBuilding } = await import('./buildingService.js');
          const building = await getBuilding(entityId);
          if (building?.teamId === teamId) {
            if (role === 'route_leader') {
              // Route leaders need to check if it's in their route
              const userRouteId = currentUser.routeId;
              if (building.routeId === userRouteId) {
                validation.allowed = true;
              } else {
                validation.reason = 'You can only delete buildings in your assigned route';
              }
            } else {
              validation.allowed = true;
            }
          } else {
            validation.reason = 'You can only delete buildings in your assigned team';
          }
        } else {
          validation.reason = 'You do not have permission to delete buildings';
        }
        break;
      }

      default:
        validation.reason = `Unknown entity type: ${entityType}`;
    }

    return validation;
  } catch (error) {
    console.error('Error validating cascade delete:', error);
    validation.reason = 'Error validating permissions';
    return validation;
  }
}

/**
 * Restore a soft-deleted entity and optionally its children
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity to restore
 * @param {boolean} restoreChildren - If true, also restore child entities (default: false)
 * @returns {Promise<Object>} Result of the restore operation
 */
export async function restoreSoftDeletedEntity(entityType, entityId, restoreChildren = false) {
  try {
    const result = {
      success: false,
      entityType,
      entityId,
      restoredAt: new Date(),
      childrenRestored: 0,
    };

    // Import necessary functions based on entity type
    switch (entityType) {
      case 'team': {
        const { updateTeam } = await import('./teamService.js');
        await updateTeam(entityId, {
          isActive: true,
          deletedAt: null,
        });
        result.success = true;

        if (restoreChildren) {
          // Restore communities in the team
          const { db } = await import('./firebase.js');
          const { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

          const communitiesQuery = query(
            collection(db, 'communities'),
            where('teamId', '==', entityId),
            where('isActive', '==', false)
          );
          const snapshot = await getDocs(communitiesQuery);

          for (const docSnap of snapshot.docs) {
            await updateDoc(doc(db, 'communities', docSnap.id), {
              isActive: true,
              deletedAt: null,
              restoredAt: serverTimestamp(),
            });
            result.childrenRestored++;
          }
        }
        break;
      }

      case 'community': {
        const { updateCommunity } = await import('./communityService.js');
        await updateCommunity(entityId, {
          isActive: true,
          deletedAt: null,
        });
        result.success = true;

        if (restoreChildren) {
          // Restore routes in the community
          const { db } = await import('./firebase.js');
          const { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

          const routesQuery = query(
            collection(db, 'routes'),
            where('communityId', '==', entityId),
            where('isActive', '==', false)
          );
          const snapshot = await getDocs(routesQuery);

          for (const docSnap of snapshot.docs) {
            await updateDoc(doc(db, 'routes', docSnap.id), {
              isActive: true,
              deletedAt: null,
              restoredAt: serverTimestamp(),
            });
            result.childrenRestored++;
          }
        }
        break;
      }

      case 'route': {
        const { updateRoute } = await import('./routeService.js');
        await updateRoute(entityId, {
          isActive: true,
          deletedAt: null,
        });
        result.success = true;

        if (restoreChildren) {
          // Restore buildings in the route
          const { db } = await import('./firebase.js');
          const { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

          const buildingsQuery = query(
            collection(db, 'buildings'),
            where('routeId', '==', entityId),
            where('isActive', '==', false)
          );
          const snapshot = await getDocs(buildingsQuery);

          for (const docSnap of snapshot.docs) {
            await updateDoc(doc(db, 'buildings', docSnap.id), {
              isActive: true,
              deletedAt: null,
              restoredAt: serverTimestamp(),
            });
            result.childrenRestored++;
          }
        }
        break;
      }

      case 'building': {
        const { updateBuilding } = await import('./buildingService.js');
        await updateBuilding(entityId, {
          isActive: true,
          deletedAt: null,
        });
        result.success = true;
        // Buildings don't have soft-deleted children (visits are hard deleted)
        break;
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    return result;
  } catch (error) {
    console.error('Error restoring soft-deleted entity:', error);
    throw error;
  }
}