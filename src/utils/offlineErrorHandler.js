/**
 * Offline Error Handler Utility
 * Provide consistent error handling for Firestore operations in offline mode
 */

/**
 * Check if an error is due to offline/network issues
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is network-related
 */
export function isOfflineError(error) {
  if (!error) return false;

  // Check Firestore error codes
  if (error.code === 'unavailable' ||
      error.code === 'failed-precondition' ||
      error.code === 'deadline-exceeded') {
    return true;
  }

  // Check error messages
  const message = error.message?.toLowerCase() || '';
  return message.includes('offline') ||
         message.includes('network') ||
         message.includes('connection') ||
         message.includes('unavailable');
}

/**
 * Handle Firestore read operations with offline fallback
 * @param {Function} operation - Async function that performs Firestore read
 * @param {*} fallbackValue - Value to return if offline (default: null)
 * @returns {Promise<*>} Result of operation or fallback value
 */
export async function handleOfflineRead(operation, fallbackValue = null) {
  try {
    return await operation();
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Operating in offline mode - using cached data or fallback value');
      return fallbackValue;
    }
    // Re-throw non-offline errors
    throw error;
  }
}

/**
 * Handle Firestore write operations with offline queueing
 * @param {Function} operation - Async function that performs Firestore write
 * @param {Object} optimisticData - Data to return optimistically if offline
 * @returns {Promise<*>} Result of operation or optimistic data
 */
export async function handleOfflineWrite(operation, optimisticData = null) {
  try {
    return await operation();
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Writing in offline mode - data will sync when online');
      // Firestore automatically queues writes, so return optimistic response
      return {
        ...optimisticData,
        _pendingSync: true,
        _offlineTimestamp: new Date(),
      };
    }
    // Re-throw non-offline errors
    throw error;
  }
}

/**
 * Handle Firestore query operations with offline fallback
 * @param {Function} operation - Async function that performs Firestore query
 * @returns {Promise<Array>} Result array or empty array if offline and no cache
 */
export async function handleOfflineQuery(operation) {
  try {
    return await operation();
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Querying in offline mode - using cached data or empty result');
      // Return empty array as fallback
      return [];
    }
    // Re-throw non-offline errors
    throw error;
  }
}

/**
 * Get user-friendly error message for offline errors
 * @param {Error} error - The error to format
 * @returns {string} User-friendly error message
 */
export function getOfflineErrorMessage(error) {
  if (isOfflineError(error)) {
    return 'You are currently offline. Changes will be saved when you reconnect.';
  }
  return error.message || 'An unexpected error occurred';
}

/**
 * Check if data is pending sync (offline write)
 * @param {Object} data - Data object to check
 * @returns {boolean} True if data is pending sync
 */
export function isPendingSync(data) {
  return data && data._pendingSync === true;
}

/**
 * Strip offline metadata from data object
 * @param {Object} data - Data object with potential offline flags
 * @returns {Object} Clean data without offline metadata
 */
export function stripOfflineMetadata(data) {
  if (!data) return data;

  const { _pendingSync, _offlineTimestamp, _offline, ...cleanData } = data;
  return cleanData;
}