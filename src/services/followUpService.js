import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  validateUnit,
  validateText,
  validateUrgency,
  validateUserId,
  validateDate,
  batchValidate,
  ValidationError,
} from '../utils/validation';

// Collections
const FOLLOWUPS_COLLECTION = 'followUps';

/**
 * Create a new follow-up record with validation
 * Works offline - will sync when connection is restored
 *
 * @param {object} followUpData - Follow-up data to create
 * @param {string} userId - ID of user creating the follow-up
 * @returns {Promise<object>} Created follow-up with ID
 * @throws {ValidationError} If validation fails
 */
export async function createFollowUp(followUpData, userId) {
  try {
    // Validate all required fields (updated for new data model)
    const validation = batchValidate({
      buildingId: () => validateUserId(followUpData.buildingId, { required: true }),
      unitNumber: () => validateUnit(followUpData.unitNumber, { required: true }),
      teamId: () => validateUserId(followUpData.teamId, { required: true }),
      routeId: () => validateUserId(followUpData.routeId, { required: true }),
      description: () => validateText(followUpData.description, {
        required: false,
        maxLength: 1000,
        fieldName: 'Description',
      }),
      status: () => followUpData.status || 'pending',
      dueDate: () => validateDate(followUpData.dueDate, { required: false, fieldName: 'Due Date' }),
      userId: () => validateUserId(userId, { required: true }),
    });

    if (!validation.isValid) {
      throw new ValidationError(
        'Validation failed',
        null,
        { errors: validation.errors }
      );
    }

    // Build sanitized payload (new data model)
    const sanitizedData = {
      buildingId: validation.data.buildingId,
      unitNumber: validation.data.unitNumber,
      teamId: validation.data.teamId,
      routeId: validation.data.routeId,
      description: validation.data.description || '',
      status: validation.data.status || 'pending', // pending, in_progress, completed
      dueDate: validation.data.dueDate || null,
      completedAt: null,
      createdBy: validation.data.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    };

    // Add to Firestore
    const followUpRef = await addDoc(
      collection(db, FOLLOWUPS_COLLECTION),
      sanitizedData
    );

    return {
      id: followUpRef.id,
      ...sanitizedData,
      success: true,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error creating follow-up:', error.details);
      throw error;
    }
    console.error('Error creating follow-up:', error);
    throw new Error('Failed to create follow-up: ' + error.message);
  }
}

/**
 * Update an existing follow-up record with validation
 * Works offline - will sync when connection is restored
 *
 * @param {string} followUpId - ID of follow-up to update
 * @param {object} updates - Fields to update
 * @param {string} userId - ID of user making the update
 * @returns {Promise<object>} Success response
 * @throws {ValidationError} If validation fails
 */
export async function updateFollowUp(followUpId, updates, userId) {
  try {
    // Validate followUpId
    if (!followUpId || typeof followUpId !== 'string') {
      throw new ValidationError('Invalid follow-up ID', 'followUpId');
    }

    // Build validation object only for fields being updated (new data model)
    const validators = {
      userId: () => validateUserId(userId, { required: true }),
    };

    if (updates.buildingId !== undefined) {
      validators.buildingId = () => validateUserId(updates.buildingId, { required: true });
    }
    if (updates.unitNumber !== undefined) {
      validators.unitNumber = () => validateUnit(updates.unitNumber, { required: true });
    }
    if (updates.teamId !== undefined) {
      validators.teamId = () => validateUserId(updates.teamId, { required: true });
    }
    if (updates.routeId !== undefined) {
      validators.routeId = () => validateUserId(updates.routeId, { required: true });
    }
    if (updates.description !== undefined) {
      validators.description = () => validateText(updates.description, {
        required: false,
        maxLength: 1000,
        fieldName: 'Description',
      });
    }
    if (updates.status !== undefined) {
      validators.status = () => updates.status; // pending, in_progress, completed
    }
    if (updates.dueDate !== undefined) {
      validators.dueDate = () => validateDate(updates.dueDate, { required: false, fieldName: 'Due Date' });
    }

    const validation = batchValidate(validators);

    if (!validation.isValid) {
      throw new ValidationError(
        'Validation failed',
        null,
        { errors: validation.errors }
      );
    }

    // Build sanitized updates object
    const sanitizedUpdates = {
      ...validation.data,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    // Handle completion timestamp
    if (updates.status === 'completed' && !sanitizedUpdates.completedAt) {
      sanitizedUpdates.completedAt = serverTimestamp();
    }

    // Remove userId from updates (it's metadata, not a field)
    delete sanitizedUpdates.userId;

    // Update in Firestore
    const followUpRef = doc(db, FOLLOWUPS_COLLECTION, followUpId);
    await updateDoc(followUpRef, sanitizedUpdates);

    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error updating follow-up:', error.details);
      throw error;
    }
    console.error('Error updating follow-up:', error);
    throw new Error('Failed to update follow-up: ' + error.message);
  }
}

/**
 * Get a single follow-up by ID
 * Works offline - returns cached data if available
 *
 * @param {string} followUpId - ID of follow-up to retrieve
 * @returns {Promise<object|null>} Follow-up data or null if not found
 */
export async function getFollowUp(followUpId) {
  try {
    if (!followUpId || typeof followUpId !== 'string') {
      throw new ValidationError('Invalid follow-up ID', 'followUpId');
    }

    const followUpDoc = await getDoc(doc(db, FOLLOWUPS_COLLECTION, followUpId));

    if (followUpDoc.exists()) {
      const data = followUpDoc.data();
      // Don't return inactive items
      if (!data.isActive) {
        return null;
      }
      return { id: followUpDoc.id, ...data };
    }

    return null;
  } catch (error) {
    console.error('Error getting follow-up:', error);
    throw error;
  }
}

/**
 * Get all follow-ups (optionally filtered)
 * Works offline - returns cached data if available
 *
 * @param {object} options - Query options
 * @returns {Promise<Array>} Array of follow-ups
 */
export async function getAllFollowUps(options = {}) {
  try {
    const {
      userId = null,
      teamId = null,
      routeId = null,
      includeDeleted = false,
      orderByField = 'createdAt',
      orderDirection = 'desc',
      limit = null,
    } = options;

    let q = collection(db, FOLLOWUPS_COLLECTION);
    const constraints = [];

    // Filter by user
    if (userId) {
      validateUserId(userId);
      constraints.push(where('createdBy', '==', userId));
    }

    // Filter by team
    if (teamId) {
      validateUserId(teamId, { required: true });
      constraints.push(where('teamId', '==', teamId));
    }

    // Filter by route
    if (routeId) {
      validateUserId(routeId, { required: true });
      constraints.push(where('routeId', '==', routeId));
    }

    // Filter to only active items by default
    if (!includeDeleted) {
      constraints.push(where('isActive', '==', true));
    }

    // Add ordering
    constraints.push(orderBy(orderByField, orderDirection));

    // Apply constraints
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const querySnapshot = await getDocs(q);

    let results = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Apply limit if specified
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  } catch (error) {
    console.error('Error getting follow-ups:', error);
    throw error;
  }
}

/**
 * Soft delete a follow-up (marks as deleted, doesn't remove)
 * Works offline - will sync when connection is restored
 *
 * @param {string} followUpId - ID of follow-up to delete
 * @param {string} userId - ID of user performing deletion
 * @returns {Promise<object>} Success response
 */
export async function softDeleteFollowUp(followUpId, userId) {
  try {
    if (!followUpId || typeof followUpId !== 'string') {
      throw new ValidationError('Invalid follow-up ID', 'followUpId');
    }

    validateUserId(userId, { required: true });

    const followUpRef = doc(db, FOLLOWUPS_COLLECTION, followUpId);

    await updateDoc(followUpRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error soft deleting follow-up:', error);
    throw error;
  }
}

/**
 * Permanently delete a follow-up from Firestore
 * Use with caution - this cannot be undone
 *
 * @param {string} followUpId - ID of follow-up to delete
 * @returns {Promise<object>} Success response
 */
export async function hardDeleteFollowUp(followUpId) {
  try {
    if (!followUpId || typeof followUpId !== 'string') {
      throw new ValidationError('Invalid follow-up ID', 'followUpId');
    }

    const followUpRef = doc(db, FOLLOWUPS_COLLECTION, followUpId);
    await deleteDoc(followUpRef);

    return { success: true };
  } catch (error) {
    console.error('Error hard deleting follow-up:', error);
    throw error;
  }
}

/**
 * Restore a soft-deleted follow-up
 * Works offline - will sync when connection is restored
 *
 * @param {string} followUpId - ID of follow-up to restore
 * @param {string} userId - ID of user performing restoration
 * @returns {Promise<object>} Success response
 */
export async function restoreFollowUp(followUpId, userId) {
  try {
    if (!followUpId || typeof followUpId !== 'string') {
      throw new ValidationError('Invalid follow-up ID', 'followUpId');
    }

    validateUserId(userId, { required: true });

    const followUpRef = doc(db, FOLLOWUPS_COLLECTION, followUpId);

    await updateDoc(followUpRef, {
      isActive: true,
      restoredAt: serverTimestamp(),
      restoredBy: userId,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error restoring follow-up:', error);
    throw error;
  }
}

/**
 * Search follow-ups by building, unit, or description
 * Works offline - searches cached data if available
 *
 * @param {string} searchTerm - Term to search for
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of matching follow-ups
 */
export async function searchFollowUps(searchTerm, options = {}) {
  try {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return [];
    }

    const sanitizedTerm = searchTerm.trim().toLowerCase();

    if (sanitizedTerm.length === 0) {
      return [];
    }

    // Get all follow-ups
    const followUps = await getAllFollowUps(options);

    // Client-side filtering (Firestore doesn't support full-text search)
    return followUps.filter((followUp) => {
      const buildingId = (followUp.buildingId || '').toLowerCase();
      const unitNumber = (followUp.unitNumber || '').toLowerCase();
      const description = (followUp.description || '').toLowerCase();

      return (
        buildingId.includes(sanitizedTerm) ||
        unitNumber.includes(sanitizedTerm) ||
        description.includes(sanitizedTerm)
      );
    });
  } catch (error) {
    console.error('Error searching follow-ups:', error);
    throw error;
  }
}

/**
 * Get follow-ups by urgency level
 * Works offline - returns cached data if available
 *
 * @param {number} minUrgency - Minimum urgency level (0-5)
 * @param {object} options - Query options
 * @returns {Promise<Array>} Array of follow-ups
 */
export async function getFollowUpsByUrgency(minUrgency = 0, options = {}) {
  try {
    const validUrgency = validateUrgency(minUrgency);
    const followUps = await getAllFollowUps(options);

    // Filter by urgency and sort descending
    return followUps
      .filter((f) => (f.urgency || 0) >= validUrgency)
      .sort((a, b) => (b.urgency || 0) - (a.urgency || 0));
  } catch (error) {
    console.error('Error getting follow-ups by urgency:', error);
    throw error;
  }
}

/**
 * Get follow-ups that need attention (high urgency or old)
 * Works offline - returns cached data if available
 *
 * @param {object} options - Query options
 * @returns {Promise<Array>} Array of follow-ups needing attention
 */
export async function getFollowUpsNeedingAttention(options = {}) {
  try {
    const { daysOld = 7, minUrgency = 3 } = options;

    const followUps = await getAllFollowUps(options);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return followUps.filter((followUp) => {
      const isUrgent = (followUp.urgency || 0) >= minUrgency;
      const lastActivity = followUp.lastActivity
        ? new Date(followUp.lastActivity)
        : new Date(0);
      const isOld = lastActivity < cutoffDate;

      return isUrgent || isOld;
    });
  } catch (error) {
    console.error('Error getting follow-ups needing attention:', error);
    throw error;
  }
}

/**
 * Bulk create follow-ups with validation
 * Useful for importing data or batch operations
 *
 * @param {Array<object>} followUpsData - Array of follow-up data
 * @param {string} userId - ID of user creating the follow-ups
 * @returns {Promise<object>} Results with successes and failures
 */
export async function bulkCreateFollowUps(followUpsData, userId) {
  const results = {
    successful: [],
    failed: [],
    total: followUpsData.length,
  };

  for (let i = 0; i < followUpsData.length; i++) {
    try {
      const created = await createFollowUp(followUpsData[i], userId);
      results.successful.push({
        index: i,
        id: created.id,
        data: followUpsData[i],
      });
    } catch (error) {
      results.failed.push({
        index: i,
        data: followUpsData[i],
        error: error.message,
        details: error.details || null,
      });
    }
  }

  return results;
}
