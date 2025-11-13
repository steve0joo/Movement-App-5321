/**
 * Sync Service
 * Handles syncing offline data to Firestore when connection is restored
 */

import { createNeighborhood, createVisit } from './neighborhoodService';
import {
  getAllOfflineDataForSync,
  clearOfflineData,
  getOfflineItemsCount,
} from '../utils/offlineStorage';

/**
 * Sync all offline data to Firestore
 * @param {string} userId - ID of authenticated user
 * @returns {Promise<object>} Sync results
 */
export async function syncOfflineData(userId) {
  if (!userId) {
    throw new Error('User ID is required for syncing');
  }

  const offlineData = getAllOfflineDataForSync();
  const results = {
    neighborhoods: { successful: 0, failed: 0, errors: [] },
    visits: { successful: 0, failed: 0, errors: [] },
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
  };

  // Sync Neighborhoods
  for (const neighborhood of offlineData.neighborhoods) {
    try {
      // Remove offline-specific fields
      const { id, isOffline, createdAt, ...cleanData } = neighborhood;

      await createNeighborhood(cleanData, userId);
      results.neighborhoods.successful++;
      results.totalSuccessful++;
    } catch (error) {
      results.neighborhoods.failed++;
      results.totalFailed++;
      results.neighborhoods.errors.push({
        item: neighborhood,
        error: error.message,
      });
      console.error('Failed to sync neighborhood:', error);
    }
    results.totalProcessed++;
  }

  // Sync Visits
  for (const visit of offlineData.visits) {
    try {
      // Remove offline-specific fields
      const { id, isOffline, createdAt, neighborhoodId, ...cleanData } = visit;

      // Note: Visit sync requires a valid neighborhoodId
      // If the neighborhood was created offline, we need to handle this differently
      if (neighborhoodId && !neighborhoodId.startsWith('offline_')) {
        await createVisit(neighborhoodId, cleanData, userId);
        results.visits.successful++;
        results.totalSuccessful++;
      } else {
        results.visits.failed++;
        results.totalFailed++;
        results.visits.errors.push({
          item: visit,
          error: 'Neighborhood ID is offline or missing - cannot sync visit',
        });
      }
    } catch (error) {
      results.visits.failed++;
      results.totalFailed++;
      results.visits.errors.push({
        item: visit,
        error: error.message,
      });
      console.error('Failed to sync visit:', error);
    }
    results.totalProcessed++;
  }

  return results;
}

/**
 * Sync offline data and clear if successful
 * @param {string} userId - ID of authenticated user
 * @returns {Promise<object>} Sync results with clearance status
 */
export async function syncAndClearOfflineData(userId) {
  const counts = getOfflineItemsCount();

  if (counts.total === 0) {
    return {
      success: true,
      message: 'No offline data to sync',
      results: null,
    };
  }

  try {
    const results = await syncOfflineData(userId);

    // Clear offline data if all items synced successfully
    if (results.totalFailed === 0) {
      const cleared = clearOfflineData();
      return {
        success: true,
        message: `Successfully synced ${results.totalSuccessful} items to database`,
        results,
        cleared,
      };
    } else {
      return {
        success: false,
        message: `Synced ${results.totalSuccessful} items, but ${results.totalFailed} failed`,
        results,
        cleared: false,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Sync failed: ' + error.message,
      results: null,
      cleared: false,
    };
  }
}

/**
 * Check if there is offline data to sync
 * @returns {boolean}
 */
export function hasOfflineDataToSync() {
  const counts = getOfflineItemsCount();
  return counts.total > 0;
}

/**
 * Get offline data summary
 * @returns {object}
 */
export function getOfflineDataSummary() {
  const counts = getOfflineItemsCount();
  const data = getAllOfflineDataForSync();

  return {
    counts,
    hasData: counts.total > 0,
    summary: `${counts.total} items (${counts.neighborhoods} neighborhoods, ${counts.visits} visits)`,
    oldestItem: getOldestOfflineItem(data),
    newestItem: getNewestOfflineItem(data),
  };
}

/**
 * Get oldest offline item
 */
function getOldestOfflineItem(data) {
  const allItems = [
    ...data.neighborhoods,
    ...data.visits,
  ];

  if (allItems.length === 0) return null;

  const oldest = allItems.reduce((oldest, item) => {
    const itemDate = new Date(item.createdAt);
    const oldestDate = new Date(oldest.createdAt);
    return itemDate < oldestDate ? item : oldest;
  });

  return {
    date: oldest.createdAt,
    type: data.neighborhoods.includes(oldest) ? 'neighborhood' : 'visit',
  };
}

/**
 * Get newest offline item
 */
function getNewestOfflineItem(data) {
  const allItems = [
    ...data.neighborhoods,
    ...data.visits,
  ];

  if (allItems.length === 0) return null;

  const newest = allItems.reduce((newest, item) => {
    const itemDate = new Date(item.createdAt);
    const newestDate = new Date(newest.createdAt);
    return itemDate > newestDate ? item : newest;
  });

  return {
    date: newest.createdAt,
    type: data.neighborhoods.includes(newest) ? 'neighborhood' : 'visit',
  };
}

/**
 * Retry failed sync items
 * @param {object} previousResults - Results from previous sync attempt
 * @param {string} userId - ID of authenticated user
 * @returns {Promise<object>} Retry results
 */
export async function retryFailedSync(previousResults, userId) {
  const retryResults = {
    neighborhoods: { successful: 0, failed: 0, errors: [] },
    visits: { successful: 0, failed: 0, errors: [] },
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
  };

  // Retry failed neighborhoods
  if (previousResults.neighborhoods?.errors) {
    for (const failedItem of previousResults.neighborhoods.errors) {
      try {
        const { id, isOffline, createdAt, ...cleanData } = failedItem.item;
        await createNeighborhood(cleanData, userId);
        retryResults.neighborhoods.successful++;
        retryResults.totalSuccessful++;
      } catch (error) {
        retryResults.neighborhoods.failed++;
        retryResults.totalFailed++;
        retryResults.neighborhoods.errors.push(failedItem);
      }
      retryResults.totalProcessed++;
    }
  }

  // Retry failed visits
  if (previousResults.visits?.errors) {
    for (const failedItem of previousResults.visits.errors) {
      try {
        const { id, isOffline, createdAt, neighborhoodId, ...cleanData } = failedItem.item;
        if (neighborhoodId && !neighborhoodId.startsWith('offline_')) {
          await createVisit(neighborhoodId, cleanData, userId);
          retryResults.visits.successful++;
          retryResults.totalSuccessful++;
        } else {
          retryResults.visits.failed++;
          retryResults.totalFailed++;
          retryResults.visits.errors.push(failedItem);
        }
      } catch (error) {
        retryResults.visits.failed++;
        retryResults.totalFailed++;
        retryResults.visits.errors.push(failedItem);
      }
      retryResults.totalProcessed++;
    }
  }

  return retryResults;
}
