/**
 * Batch Helpers
 * Utilities for performing batch operations in Firestore
 *
 * Firebase limits batches to 500 operations per batch.
 * These helpers automatically split large operations into multiple batches.
 */

import { writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';

const MAX_BATCH_SIZE = 500;

/**
 * Delete multiple documents atomically using batches
 * Automatically split into multiple batches if > 500 operations
 *
 * @param {Array<DocumentReference>} docRefs - Array of Firestore document references to delete
 * @returns {Promise<{success: boolean, deletedCount: number, batchCount: number}>}
 */
export async function batchDelete(docRefs) {
  if (!docRefs || docRefs.length === 0) {
    return { success: true, deletedCount: 0, batchCount: 0 };
  }

  try {
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationsInBatch = 0;

    docRefs.forEach((docRef, index) => {
      currentBatch.delete(docRef);
      operationsInBatch++;

      // If we've hit the limit or this is the last operation, commit the batch
      if (operationsInBatch === MAX_BATCH_SIZE || index === docRefs.length - 1) {
        batches.push(currentBatch);

        // Start a new batch if there are more operations
        if (index < docRefs.length - 1) {
          currentBatch = writeBatch(db);
          operationsInBatch = 0;
        }
      }
    });

    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));

    return {
      success: true,
      deletedCount: docRefs.length,
      batchCount: batches.length,
    };
  } catch (error) {
    console.error('Error in batchDelete:', error);
    throw error;
  }
}

/**
 * Update multiple documents atomically using batches
 * Automatically split into multiple batches if > 500 operations
 *
 * @param {Array<{ref: DocumentReference, data: Object}>} updates - Array of {ref, data} objects
 * @returns {Promise<{success: boolean, updatedCount: number, batchCount: number}>}
 */
export async function batchUpdate(updates) {
  if (!updates || updates.length === 0) {
    return { success: true, updatedCount: 0, batchCount: 0 };
  }

  try {
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationsInBatch = 0;

    updates.forEach((update, index) => {
      currentBatch.update(update.ref, update.data);
      operationsInBatch++;

      // If we've hit the limit or this is the last operation, commit the batch
      if (operationsInBatch === MAX_BATCH_SIZE || index === updates.length - 1) {
        batches.push(currentBatch);

        // Start a new batch if there are more operations
        if (index < updates.length - 1) {
          currentBatch = writeBatch(db);
          operationsInBatch = 0;
        }
      }
    });

    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));

    return {
      success: true,
      updatedCount: updates.length,
      batchCount: batches.length,
    };
  } catch (error) {
    console.error('Error in batchUpdate:', error);
    throw error;
  }
}

/**
 * Create multiple documents atomically using batches
 * Automatically split into multiple batches if > 500 operations
 *
 * @param {Array<{ref: DocumentReference, data: Object}>} creates - Array of {ref, data} objects
 * @returns {Promise<{success: boolean, createdCount: number, batchCount: number}>}
 */
export async function batchCreate(creates) {
  if (!creates || creates.length === 0) {
    return { success: true, createdCount: 0, batchCount: 0 };
  }

  try {
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationsInBatch = 0;

    creates.forEach((create, index) => {
      currentBatch.set(create.ref, create.data);
      operationsInBatch++;

      // If we've hit the limit or this is the last operation, commit the batch
      if (operationsInBatch === MAX_BATCH_SIZE || index === creates.length - 1) {
        batches.push(currentBatch);

        // Start a new batch if there are more operations
        if (index < creates.length - 1) {
          currentBatch = writeBatch(db);
          operationsInBatch = 0;
        }
      }
    });

    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));

    return {
      success: true,
      createdCount: creates.length,
      batchCount: batches.length,
    };
  } catch (error) {
    console.error('Error in batchCreate:', error);
    throw error;
  }
}