/**
 * Offline Storage Manager
 * Handles offline mode state and user information
 *
 * Note: Firebase Firestore's automatic offline persistence handles ALL data caching.
 * This file only manages:
 * 1. Offline mode flag (UI state)
 * 2. User info for offline display
 * 3. Last visit form data for auto-fill convenience
 */

const OFFLINE_STORAGE_KEYS = {
  OFFLINE_MODE: 'offline_mode_active',
  OFFLINE_USER: 'offline_user_info',
  LAST_VISIT_FORM: 'last_visit_form_data',
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
 * Clear all offline mode data including user info and form cache
 */
export function exitOfflineMode() {
  try {
    disableOfflineMode();
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.OFFLINE_USER);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.LAST_VISIT_FORM);
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
    if (!data) return null;

    const parsed = JSON.parse(data);

    // Expire cached form data after 30 days
    const age = Date.now() - new Date(parsed.timestamp).getTime();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (age > MAX_AGE) {
      console.log('Last visit form data expired (30 days), clearing cache!');
      clearLastVisitFormData();
      return null;
    }

    return parsed;
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

