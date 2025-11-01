/**
 * Offline Storage Manager
 * Handles local data storage when user is in offline mode
 * Syncs data to Firestore when connection is restored
 */

const OFFLINE_STORAGE_KEYS = {
  FOLLOW_UPS: 'offline_followups',
  NEIGHBORHOODS: 'offline_neighborhoods',
  VISITS: 'offline_visits',
  OFFLINE_MODE: 'offline_mode_active',
  OFFLINE_USER: 'offline_user_info',
  SYNC_QUEUE: 'offline_sync_queue',
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
 * Save follow-up to offline storage
 */
export function saveOfflineFollowUp(followUpData) {
  try {
    const existing = getOfflineFollowUps();
    const newItem = {
      ...followUpData,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    existing.push(newItem);
    localStorage.setItem(OFFLINE_STORAGE_KEYS.FOLLOW_UPS, JSON.stringify(existing));
    return { success: true, id: newItem.id, data: newItem };
  } catch (error) {
    console.error('Failed to save offline follow-up:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all offline follow-ups
 */
export function getOfflineFollowUps() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.FOLLOW_UPS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save data to offline storage
 */
export function saveOfflineNeighborhood(neighborhoodData) {
  try {
    const existing = getOfflineNeighborhoods();
    const newItem = {
      ...neighborhoodData,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    existing.push(newItem);
    localStorage.setItem(OFFLINE_STORAGE_KEYS.NEIGHBORHOODS, JSON.stringify(existing));
    return { success: true, id: newItem.id, data: newItem };
  } catch (error) {
    console.error('Failed to save offline neighborhood:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all offline data
 */
export function getOfflineNeighborhoods() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.NEIGHBORHOODS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save visit to offline storage
 */
export function saveOfflineVisit(visitData) {
  try {
    const existing = getOfflineVisits();
    const newItem = {
      ...visitData,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    existing.push(newItem);
    localStorage.setItem(OFFLINE_STORAGE_KEYS.VISITS, JSON.stringify(existing));
    return { success: true, id: newItem.id, data: newItem };
  } catch (error) {
    console.error('Failed to save offline visit:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all offline visits
 */
export function getOfflineVisits() {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEYS.VISITS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a specific offline item
 */
export function deleteOfflineItem(id, type) {
  try {
    let key;
    let getter;

    switch (type) {
      case 'followup':
        key = OFFLINE_STORAGE_KEYS.FOLLOW_UPS;
        getter = getOfflineFollowUps;
        break;
      case 'neighborhood':
        key = OFFLINE_STORAGE_KEYS.NEIGHBORHOODS;
        getter = getOfflineNeighborhoods;
        break;
      case 'visit':
        key = OFFLINE_STORAGE_KEYS.VISITS;
        getter = getOfflineVisits;
        break;
      default:
        return { success: false, error: 'Invalid type' };
    }

    const items = getter();
    const filtered = items.filter((item) => item.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    return { success: true };
  } catch (error) {
    console.error('Failed to delete offline item:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get count of all offline items
 */
export function getOfflineItemsCount() {
  return {
    followUps: getOfflineFollowUps().length,
    neighborhoods: getOfflineNeighborhoods().length,
    visits: getOfflineVisits().length,
    total:
      getOfflineFollowUps().length +
      getOfflineNeighborhoods().length +
      getOfflineVisits().length,
  };
}

/**
 * Clear all offline data (after successful sync)
 */
export function clearOfflineData() {
  try {
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.FOLLOW_UPS);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.NEIGHBORHOODS);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.VISITS);
    localStorage.removeItem(OFFLINE_STORAGE_KEYS.SYNC_QUEUE);
    return true;
  } catch (error) {
    console.error('Failed to clear offline data:', error);
    return false;
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

/**
 * Get all offline data for syncing
 */
export function getAllOfflineDataForSync() {
  return {
    followUps: getOfflineFollowUps(),
    neighborhoods: getOfflineNeighborhoods(),
    visits: getOfflineVisits(),
  };
}

/**
 * Update offline item
 */
export function updateOfflineItem(id, updates, type) {
  try {
    let key;
    let getter;

    switch (type) {
      case 'followup':
        key = OFFLINE_STORAGE_KEYS.FOLLOW_UPS;
        getter = getOfflineFollowUps;
        break;
      case 'neighborhood':
        key = OFFLINE_STORAGE_KEYS.NEIGHBORHOODS;
        getter = getOfflineNeighborhoods;
        break;
      case 'visit':
        key = OFFLINE_STORAGE_KEYS.VISITS;
        getter = getOfflineVisits;
        break;
      default:
        return { success: false, error: 'Invalid type' };
    }

    const items = getter();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return { success: false, error: 'Item not found' };
    }

    items[index] = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(key, JSON.stringify(items));
    return { success: true, data: items[index] };
  } catch (error) {
    console.error('Failed to update offline item:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search offline follow-ups (updated for new data model)
 */
export function searchOfflineFollowUps(searchTerm) {
  const followUps = getOfflineFollowUps();
  if (!searchTerm) return followUps;

  const term = searchTerm.toLowerCase();
  return followUps.filter(
    (item) =>
      (item.buildingId || '').toLowerCase().includes(term) ||
      (item.unitNumber || item.unit || '').toLowerCase().includes(term) ||
      (item.description || item.followUp || '').toLowerCase().includes(term) ||
      (item.teamId || item.team || '').toLowerCase().includes(term)
  );
}

/**
 * Export offline data as JSON (for backup)
 */
export function exportOfflineData() {
  const data = {
    exportDate: new Date().toISOString(),
    user: getOfflineUser(),
    counts: getOfflineItemsCount(),
    data: getAllOfflineDataForSync(),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
  try {
    const followUps = JSON.stringify(getOfflineFollowUps()).length;
    const neighborhoods = JSON.stringify(getOfflineNeighborhoods()).length;
    const visits = JSON.stringify(getOfflineVisits()).length;
    const total = followUps + neighborhoods + visits;

    return {
      followUps: `${(followUps / 1024).toFixed(2)} KB`,
      neighborhoods: `${(neighborhoods / 1024).toFixed(2)} KB`,
      visits: `${(visits / 1024).toFixed(2)} KB`,
      total: `${(total / 1024).toFixed(2)} KB`,
      percentUsed:
        typeof navigator.storage !== 'undefined' ? 'Calculating...' : 'N/A',
    };
  } catch {
    return null;
  }
}
