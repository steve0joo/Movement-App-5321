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

// Collections
const NEIGHBORHOODS_COLLECTION = 'neighborhoods';
const VISITS_SUBCOLLECTION = 'visits';

/**
 * Create a new neighborhood record
 * Works offline - will sync when connection is restored
 */
export async function createNeighborhood(neighborhoodData, userId) {
  try {
    const neighborhoodRef = await addDoc(collection(db, NEIGHBORHOODS_COLLECTION), {
      ...neighborhoodData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastVisitDate: null,
      visitCount: 0,
    });
    return { id: neighborhoodRef.id, success: true };
  } catch (error) {
    console.error('Error creating neighborhood:', error);
    throw error;
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
 * Update neighborhood information
 * Works offline - will sync when connection is restored
 */
export async function updateNeighborhood(neighborhoodId, updates) {
  try {
    const neighborhoodRef = doc(db, NEIGHBORHOODS_COLLECTION, neighborhoodId);
    await updateDoc(neighborhoodRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating neighborhood:', error);
    throw error;
  }
}

/**
 * Create a visit record for a neighborhood
 * Works offline - will sync when connection is restored
 */
export async function createVisit(neighborhoodId, visitData, userId) {
  try {
    // Add visit to subcollection
    const visitsRef = collection(db, NEIGHBORHOODS_COLLECTION, neighborhoodId, VISITS_SUBCOLLECTION);
    const visitRef = await addDoc(visitsRef, {
      ...visitData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      visitDate: visitData.visitDate || serverTimestamp(),
    });

    // Update neighborhood last visit date and visit count
    const neighborhoodRef = doc(db, NEIGHBORHOODS_COLLECTION, neighborhoodId);
    const neighborhoodDoc = await getDoc(neighborhoodRef);
    const currentCount = neighborhoodDoc.data()?.visitCount || 0;

    await updateDoc(neighborhoodRef, {
      lastVisitDate: serverTimestamp(),
      visitCount: currentCount + 1,
      updatedAt: serverTimestamp(),
    });

    return { id: visitRef.id, success: true };
  } catch (error) {
    console.error('Error creating visit:', error);
    throw error;
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
