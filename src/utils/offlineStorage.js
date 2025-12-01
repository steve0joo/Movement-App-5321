/**
 * Offline Storage Manager
 * Handles offline mode state and user information
 *
 * Note: Firebase Firestore's automatic offline persistence handles data caching.
 * This file only manages the offline mode flag and user info for UI purposes.
 */

const OFFLINE_STORAGE_KEYS = {
  OFFLINE_MODE: 'offline_mode_active',
  OFFLINE_USER: 'offline_user_info',
  LAST_VISIT_FORM: 'last_visit_form_data',
  CACHED_TEAMS: 'cached_teams',
  CACHED_COMMUNITIES: 'cached_communities',
  CACHED_ROUTES: 'cached_routes',
  CACHED_BUILDINGS: 'cached_buildings',
};

/**
 * Check if offline mode is active
 */
export function isOfflineModeActive() {
  try {
    return localStorage.getItem(OFFLINE_STORAGE_KEYS.OFFLINE_MODE) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable offline mode
 */
export function enableOfflineMode() {
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEYS.OFFLINE_MODE, 'true');
    return true;
  } catch (error) {
    console.error('Failed to enable offline mode:', error);
    return false;
  }
}

/**
 * Disable offline mode
 */
export function disableOfflineMode() {
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEYS.OFFLINE_MODE, 'false');
    return true;
  } catch (error) {
    console.error('Failed to disable offline mode:', error);
    return false;
  }
}

/**
 * Set offline user info (for display purposes)
 */
export function setOfflineUser(userInfo) {
  try {
    localStorage.setItem(
      OFFLINE_STORAGE_KEYS.OFFLINE_USER,
      JSON.stringify({
        displayName: userInfo.displayName || 'Offline User',
        email: userInfo.email || null,
        role: userInfo.role || 'volunteer',
        timestamp: new Date().toISOString(),
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to set offline user:', error);
    return false;
  }
}

/**
 * Get offline user info
 */
export function getOfflineUser() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.OFFLINE_USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}



/**
 * Clear all offline mode data including user info and cached data
 */
export function exitOfflineMode() {
  try {
    disableOfflineMode();
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.OFFLINE_USER);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.LAST_VISIT_FORM);
    clearCachedUserData();
    return true;
  } catch (error) {
    console.error('Failed to exit offline mode:', error);
    return false;
  }
}

/**
 * Save the last visit form data for auto-fill
 * @param {object} formData - Form data to cache
 * @param {string} formData.teamId - Team ID
 * @param {string} formData.teamName - Team name
 * @param {string} formData.communityId - Community ID
 * @param {string} formData.communityName - Community name
 * @param {string} formData.routeId - Route ID
 * @param {string} formData.routeName - Route name
 * @param {string} formData.buildingId - Building ID
 * @param {string} formData.buildingName - Building name
 * @param {string} formData.unitNumber - Unit number
 */
export function saveLastVisitFormData(formData) {
  try {
    localStorage.setItem(
      OFFLINE_STORAGE_KEYS.LAST_VISIT_FORM,
      JSON.stringify({
        ...formData,
        timestamp: new Date().toISOString(),
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to save last visit form data:', error);
    return false;
  }
}

/**
 * Get last visit form data for auto-fill
 * @returns {object|null} Last form data or null
 */
export function getLastVisitFormData() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.LAST_VISIT_FORM);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get last visit form data:', error);
    return null;
  }
}

/**
 * Clear the last visit form data
 */
export function clearLastVisitFormData() {
  try {
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.LAST_VISIT_FORM);
    return true;
  } catch (error) {
    console.error('Failed to clear last visit form data:', error);
    return false;
  }
}

/**
 * Cache user's assigned data when they log in (for offline access)
 * Only cache the data for users who have been assigned by supervisors (have teamId)
 * @param {object} userData - User's assigned data
 * @param {string} userData.userId - User ID
 * @param {string} userData.teamId - User's assigned team ID (required)
 * @param {array} userData.teams - Array of team objects
 * @param {array} userData.communities - Array of community objects
 * @param {array} userData.routes - Array of route objects
 * @param {array} userData.buildings - Array of building objects
 */
export function cacheUserData(userData) {
  try {
    // Only cache data for the users who have been assigned by supervisors
    if (!userData.teamId) {
      console.log('⚠️ Skipping cache: User not assigned to a team yet');
      return false;
    }

    const timestamp = new Date().toISOString();

    if (userData.teams) {
      localStorage.setItem(
        OFFLINE_STORAGE_KEYS.CACHED_TEAMS,
        JSON.stringify({ data: userData.teams, timestamp })
      );
    }

    if (userData.communities) {
      localStorage.setItem(
        OFFLINE_STORAGE_KEYS.CACHED_COMMUNITIES,
        JSON.stringify({ data: userData.communities, timestamp })
      );
    }

    if (userData.routes) {
      localStorage.setItem(
        OFFLINE_STORAGE_KEYS.CACHED_ROUTES,
        JSON.stringify({ data: userData.routes, timestamp })
      );
    }

    if (userData.buildings) {
      localStorage.setItem(
        OFFLINE_STORAGE_KEYS.CACHED_BUILDINGS,
        JSON.stringify({ data: userData.buildings, timestamp })
      );
    }

    console.log('✅ Cached user data for offline access:', {
      userId: userData.userId,
      teamId: userData.teamId,
      teams: userData.teams?.length || 0,
      communities: userData.communities?.length || 0,
      routes: userData.routes?.length || 0,
      buildings: userData.buildings?.length || 0,
    });

    return true;
  } catch (error) {
    console.error('Failed to cache user data:', error);
    return false;
  }
}

/**
 * Get cached teams
 * @returns {array} Array of cached team objects
 */
export function getCachedTeams() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.CACHED_TEAMS);
    return data ? JSON.parse(data).data : [];
  } catch (error) {
    console.error('Failed to get cached teams:', error);
    return [];
  }
}

/**
 * Get cached communities
 * @returns {array} Array of cached community objects
 */
export function getCachedCommunities() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.CACHED_COMMUNITIES);
    return data ? JSON.parse(data).data : [];
  } catch (error) {
    console.error('Failed to get cached communities:', error);
    return [];
  }
}

/**
 * Get cached routes
 * @returns {array} Array of cached route objects
 */
export function getCachedRoutes() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.CACHED_ROUTES);
    return data ? JSON.parse(data).data : [];
  } catch (error) {
    console.error('Failed to get cached routes:', error);
    return [];
  }
}

/**
 * Get cached buildings
 * @returns {array} Array of cached building objects
 */
export function getCachedBuildings() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.CACHED_BUILDINGS);
    return data ? JSON.parse(data).data : [];
  } catch (error) {
    console.error('Failed to get cached buildings:', error);
    return [];
  }
}

/**
 * Clear all cached user data
 */
export function clearCachedUserData() {
  try {
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.CACHED_TEAMS);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.CACHED_COMMUNITIES);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.CACHED_ROUTES);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.CACHED_BUILDINGS);
    return true;
  } catch (error) {
    console.error('Failed to clear cached user data:', error);
    return false;
  }
}

