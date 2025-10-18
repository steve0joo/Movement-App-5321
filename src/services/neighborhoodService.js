import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  validateName,
  validateAddress,
  validatePhone,
  validateEmail,
  validateText,
  validateUserId,
  validateDate,
  batchValidate,
  ValidationError,
} from '../utils/validation';

// Collections
const NEIGHBORHOODS_COLLECTION = 'neighborhoods';
const VISITS_SUBCOLLECTION = 'visits';

/**
 * Create a new neighborhood record with validation
 * Works offline - will sync when connection is restored
 *
 * @param {object} neighborhoodData - Neighborhood data to create
 * @param {string} userId - ID of user creating the neighborhood
 * @returns {Promise<object>} Created neighborhood with ID
 * @throws {ValidationError} If validation fails
 */
export async function createNeighborhood(neighborhoodData, userId) {
  try {
    // Validate all fields
    const validation = batchValidate({
      name: () => validateName(neighborhoodData.name, {
        required: true,
        minLength: 2,
        maxLength: 200,
        fieldName: 'Neighborhood name',
      }),
      address: () => validateAddress(neighborhoodData.address, {
        required: false,
        maxLength: 500,
      }),
      contactName: () => validateName(neighborhoodData.contactName, {
        required: false,
        minLength: 2,
        maxLength: 100,
        fieldName: 'Contact name',
      }),
      contactPhone: () => validatePhone(neighborhoodData.contactPhone, {
        required: false,
      }),
      contactEmail: () => {
        if (!neighborhoodData.contactEmail) return null;
        return validateEmail(neighborhoodData.contactEmail);
      },
      description: () => validateText(neighborhoodData.description, {
        required: false,
        maxLength: 2000,
        fieldName: 'Description',
      }),
      notes: () => validateText(neighborhoodData.notes, {
        required: false,
        maxLength: 5000,
        fieldName: 'Notes',
      }),
      userId: () => validateUserId(userId, { required: true }),
    });

    if (!validation.isValid) {
      throw new ValidationError(
        'Validation failed',
        null,
        { errors: validation.errors }
      );
    }

    // Build sanitized payload
    const sanitizedData = {
      name: validation.data.name,
      address: validation.data.address || '',
      contactName: validation.data.contactName || '',
      contactPhone: validation.data.contactPhone || '',
      contactEmail: validation.data.contactEmail || '',
      description: validation.data.description || '',
      notes: validation.data.notes || '',
      createdBy: validation.data.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastVisitDate: null,
      visitCount: 0,
      isActive: true,
    };

    const neighborhoodRef = await addDoc(
      collection(db, NEIGHBORHOODS_COLLECTION),
      sanitizedData
    );

    return {
      id: neighborhoodRef.id,
      ...sanitizedData,
      success: true,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error creating neighborhood:', error.details);
      throw error;
    }
    console.error('Error creating neighborhood:', error);
    throw new Error('Failed to create neighborhood: ' + error.message);
  }
}

/**
 * Get a single neighborhood by ID
 * Works offline - returns cached data if available
 */
export async function getNeighborhood(neighborhoodId) {
  try {
    const neighborhoodDoc = await getDoc(doc(db, NEIGHBORHOODS_COLLECTION, neighborhoodId));
    if (neighborhoodDoc.exists()) {
      return { id: neighborhoodDoc.id, ...neighborhoodDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting neighborhood:', error);
    throw error;
  }
}

/**
 * Get all neighborhoods (optionally filtered by user)
 * Works offline - returns cached data if available
 */
export async function getAllNeighborhoods(userId = null) {
  try {
    let q = collection(db, NEIGHBORHOODS_COLLECTION);

    if (userId) {
      q = query(q, where('createdBy', '==', userId));
    }

    q = query(q, orderBy('updatedAt', 'desc'));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting neighborhoods:', error);
    throw error;
  }
}

/**
 * Update neighborhood information with validation
 * Works offline - will sync when connection is restored
 *
 * @param {string} neighborhoodId - ID of neighborhood to update
 * @param {object} updates - Fields to update
 * @param {string} userId - ID of user making the update
 * @returns {Promise<object>} Success response
 * @throws {ValidationError} If validation fails
 */
export async function updateNeighborhood(neighborhoodId, updates, userId) {
  try {
    // Validate neighborhoodId
    if (!neighborhoodId || typeof neighborhoodId !== 'string') {
      throw new ValidationError('Invalid neighborhood ID', 'neighborhoodId');
    }

    // Build validation object only for fields being updated
    const validators = {};

    if (userId) {
      validators.userId = () => validateUserId(userId, { required: true });
    }

    if (updates.name !== undefined) {
      validators.name = () => validateName(updates.name, {
        required: true,
        minLength: 2,
        maxLength: 200,
        fieldName: 'Neighborhood name',
      });
    }
    if (updates.address !== undefined) {
      validators.address = () => validateAddress(updates.address, {
        required: false,
        maxLength: 500,
      });
    }
    if (updates.contactName !== undefined) {
      validators.contactName = () => validateName(updates.contactName, {
        required: false,
        minLength: 2,
        maxLength: 100,
        fieldName: 'Contact name',
      });
    }
    if (updates.contactPhone !== undefined) {
      validators.contactPhone = () => validatePhone(updates.contactPhone, {
        required: false,
      });
    }
    if (updates.contactEmail !== undefined) {
      validators.contactEmail = () => {
        if (!updates.contactEmail) return null;
        return validateEmail(updates.contactEmail);
      };
    }
    if (updates.description !== undefined) {
      validators.description = () => validateText(updates.description, {
        required: false,
        maxLength: 2000,
        fieldName: 'Description',
      });
    }
    if (updates.notes !== undefined) {
      validators.notes = () => validateText(updates.notes, {
        required: false,
        maxLength: 5000,
        fieldName: 'Notes',
      });
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
    };

    // Remove userId from updates (it's metadata)
    if (userId) {
      sanitizedUpdates.updatedBy = userId;
      delete sanitizedUpdates.userId;
    }

    const neighborhoodRef = doc(db, NEIGHBORHOODS_COLLECTION, neighborhoodId);
    await updateDoc(neighborhoodRef, sanitizedUpdates);

    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error updating neighborhood:', error.details);
      throw error;
    }
    console.error('Error updating neighborhood:', error);
    throw new Error('Failed to update neighborhood: ' + error.message);
  }
}

/**
 * Create a visit record for a neighborhood with validation
 * Works offline - will sync when connection is restored
 *
 * @param {string} neighborhoodId - ID of neighborhood being visited
 * @param {object} visitData - Visit data to create
 * @param {string} userId - ID of user creating the visit
 * @returns {Promise<object>} Created visit with ID
 * @throws {ValidationError} If validation fails
 */
export async function createVisit(neighborhoodId, visitData, userId) {
  try {
    // Validate neighborhoodId
    if (!neighborhoodId || typeof neighborhoodId !== 'string') {
      throw new ValidationError('Invalid neighborhood ID', 'neighborhoodId');
    }

    // Validate visit data
    const validation = batchValidate({
      visitDate: () => validateDate(visitData.visitDate, {
        required: false,
        maxDate: new Date(),
        fieldName: 'Visit date',
      }),
      notes: () => validateText(visitData.notes, {
        required: false,
        maxLength: 5000,
        fieldName: 'Visit notes',
      }),
      attendees: () => validateText(visitData.attendees, {
        required: false,
        maxLength: 1000,
        fieldName: 'Attendees',
      }),
      purpose: () => validateText(visitData.purpose, {
        required: false,
        maxLength: 500,
        fieldName: 'Purpose',
      }),
      followUpNeeded: () => {
        // Boolean or null
        if (visitData.followUpNeeded === undefined || visitData.followUpNeeded === null) {
          return false;
        }
        return Boolean(visitData.followUpNeeded);
      },
      userId: () => validateUserId(userId, { required: true }),
    });

    if (!validation.isValid) {
      throw new ValidationError(
        'Validation failed',
        null,
        { errors: validation.errors }
      );
    }

    // Build sanitized payload
    const sanitizedData = {
      visitDate: validation.data.visitDate || new Date(),
      notes: validation.data.notes || '',
      attendees: validation.data.attendees || '',
      purpose: validation.data.purpose || '',
      followUpNeeded: validation.data.followUpNeeded,
      createdBy: validation.data.userId,
      createdAt: serverTimestamp(),
      neighborhoodId,
    };

    // Add visit to subcollection
    const visitsRef = collection(
      db,
      NEIGHBORHOODS_COLLECTION,
      neighborhoodId,
      VISITS_SUBCOLLECTION
    );
    const visitRef = await addDoc(visitsRef, sanitizedData);

    // Update neighborhood last visit date and visit count
    const neighborhoodRef = doc(db, NEIGHBORHOODS_COLLECTION, neighborhoodId);
    const neighborhoodDoc = await getDoc(neighborhoodRef);

    if (!neighborhoodDoc.exists()) {
      throw new ValidationError(
        'Neighborhood not found',
        'neighborhoodId',
        { neighborhoodId }
      );
    }

    const currentCount = neighborhoodDoc.data()?.visitCount || 0;

    await updateDoc(neighborhoodRef, {
      lastVisitDate: serverTimestamp(),
      visitCount: currentCount + 1,
      updatedAt: serverTimestamp(),
    });

    return {
      id: visitRef.id,
      ...sanitizedData,
      success: true,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error creating visit:', error.details);
      throw error;
    }
    console.error('Error creating visit:', error);
    throw new Error('Failed to create visit: ' + error.message);
  }
}

/**
 * Get all visits for a neighborhood
 * Works offline - returns cached data if available
 */
export async function getNeighborhoodVisits(neighborhoodId) {
  try {
    const visitsRef = collection(db, NEIGHBORHOODS_COLLECTION, neighborhoodId, VISITS_SUBCOLLECTION);
    const q = query(visitsRef, orderBy('visitDate', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting visits:', error);
    throw error;
  }
}

/**
 * Search neighborhoods by name or address
 * Works offline - searches cached data if available
 */
export async function searchNeighborhoods(searchTerm) {
  try {
    // Note: This is a simple implementation. For production, consider using
    // Algolia or similar for better search capabilities
    const neighborhoods = await getAllNeighborhoods();
    const lowerSearch = searchTerm.toLowerCase();

    return neighborhoods.filter((neighborhood) => {
      const neighborhoodName = (neighborhood.name || '').toLowerCase();
      const address = (neighborhood.address || '').toLowerCase();
      const contactName = (neighborhood.contactName || '').toLowerCase();

      return (
        neighborhoodName.includes(lowerSearch) ||
        address.includes(lowerSearch) ||
        contactName.includes(lowerSearch)
      );
    });
  } catch (error) {
    console.error('Error searching neighborhoods:', error);
    throw error;
  }
}
