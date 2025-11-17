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
 * Clear all offline mode data including user info
 */
export function exitOfflineMode() {
  try {
    disableOfflineMode();
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.OFFLINE_USER);
    return true;
  } catch (error) {
    console.error('Failed to exit offline mode:', error);
    return false;
  }
}

