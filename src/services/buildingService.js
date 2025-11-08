/**
 * Building Service
 * Handles CRUD operations for buildings (with units) and their visits
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const BUILDINGS_COLLECTION = 'buildings';
const VISITS_SUBCOLLECTION = 'visits';

/**
 * Create a new building
 * @param {Object} buildingData - Building information
 * @param {string} buildingData.name - Building name
 * @param {string} buildingData.address - Building address
 * @param {string} buildingData.routeId - Route ID this building belongs to
 * @param {string} buildingData.communityId - Community ID
 * @param {string} buildingData.teamId - Team ID
 * @param {Array<string>} buildingData.units - Array of unit numbers/names
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created building with ID
 */
export async function createBuilding(buildingData, createdBy) {
  try {
    const buildingRef = await addDoc(collection(db, BUILDINGS_COLLECTION), {
      name: buildingData.name,
      address: buildingData.address || '',
      routeId: buildingData.routeId,
      communityId: buildingData.communityId,
      teamId: buildingData.teamId,
      units: buildingData.units || [],
      createdBy,
      createdAt: serverTimestamp(),
      lastVisitDate: null,
      visitCount: 0,
      isActive: true,
    });

    return {
      id: buildingRef.id,
      ...buildingData,
    };
  } catch (error) {
    console.error('Error creating building:', error);
    throw error;
  }
}

/**
 * Get a single building by ID
 * @param {string} buildingId - Building ID
 * @returns {Promise<Object|null>} Building data or null if not found
 */
export async function getBuilding(buildingId) {
  try {
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    const buildingSnap = await getDoc(buildingRef);

    if (buildingSnap.exists()) {
      return {
        id: buildingSnap.id,
        ...buildingSnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting building:', error);
    throw error;
  }
}

/**
 * Get all buildings for a specific route
 * @param {string} routeId - Route ID
 * @returns {Promise<Array>} Array of buildings in the route
 */
export async function getBuildingsByRoute(routeId) {
  try {
    const buildingsQuery = query(
      collection(db, BUILDINGS_COLLECTION),
      where('routeId', '==', routeId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(buildingsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting buildings by route:', error);
    throw error;
  }
}

/**
 * Get all buildings for a specific team
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of buildings in the team
 */
export async function getBuildingsByTeam(teamId) {
  try {
    const buildingsQuery = query(
      collection(db, BUILDINGS_COLLECTION),
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(buildingsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting buildings by team:', error);
    throw error;
  }
}

/**
 * Get all buildings for a specific community
 * @param {string} communityId - Community ID
 * @returns {Promise<Array>} Array of buildings in the community
 */
export async function getBuildingsByCommunity(communityId) {
  try {
    const buildingsQuery = query(
      collection(db, BUILDINGS_COLLECTION),
      where('communityId', '==', communityId),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(buildingsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting buildings by community:', error);
    throw error;
  }
}

/**
 * Update building information
 * @param {string} buildingId - Building ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateBuilding(buildingId, updates) {
  try {
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    await updateDoc(buildingRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating building:', error);
    throw error;
  }
}

/**
 * Add a unit to a building
 * @param {string} buildingId - Building ID
 * @param {string} unitNumber - Unit number/name to add
 * @returns {Promise<void>}
 */
export async function addUnit(buildingId, unitNumber) {
  try {
    const building = await getBuilding(buildingId);
    if (!building) {
      throw new Error('Building not found');
    }

    const units = building.units || [];
    if (!units.includes(unitNumber)) {
      units.push(unitNumber);
      await updateBuilding(buildingId, { units });
    }
  } catch (error) {
    console.error('Error adding unit:', error);
    throw error;
  }
}

/**
 * Soft delete a building (set isActive to false)
 * @param {string} buildingId - Building ID
 * @returns {Promise<void>}
 */
export async function deleteBuilding(buildingId) {
  try {
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    await updateDoc(buildingRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting building:', error);
    throw error;
  }
}

// ===========================
// Visit Operations
// ===========================

/**
 * Create a visit for a building/unit
 * @param {string} buildingId - Building ID
 * @param {Object} visitData - Visit information
 * @param {string} visitData.unitNumber - Unit number/name
 * @param {string} visitData.notes - Visit notes
 * @param {Array<string>} visitData.photoUrls - Photo URLs (optional)
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created visit with ID
 */
export async function createVisit(buildingId, visitData, createdBy) {
  try {
    const visitsRef = collection(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION);

    const visitRef = await addDoc(visitsRef, {
      unitNumber: visitData.unitNumber,
      notes: visitData.notes || '',
      photoUrls: visitData.photoUrls || [],
      visitDate: visitData.visitDate || serverTimestamp(),
      createdBy,
      createdAt: serverTimestamp(),
    });

    // Update building's lastVisitDate and visitCount
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    const building = await getDoc(buildingRef);
    const currentCount = building.data()?.visitCount || 0;

    await updateDoc(buildingRef, {
      lastVisitDate: serverTimestamp(),
      visitCount: currentCount + 1,
    });

    return {
      id: visitRef.id,
      buildingId,
      ...visitData,
    };
  } catch (error) {
    console.error('Error creating visit:', error);
    throw error;
  }
}

/**
 * Get all visits for a building
 * @param {string} buildingId - Building ID
 * @returns {Promise<Array>} Array of visits
 */
export async function getBuildingVisits(buildingId) {
  try {
    const visitsQuery = query(
      collection(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION),
      orderBy('visitDate', 'desc')
    );
    const snapshot = await getDocs(visitsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      buildingId,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting building visits:', error);
    throw error;
  }
}

/**
 * Get visits for a specific unit in a building
 * @param {string} buildingId - Building ID
 * @param {string} unitNumber - Unit number/name
 * @returns {Promise<Array>} Array of visits for the unit
 */
export async function getVisitsByUnit(buildingId, unitNumber) {
  try {
    const visitsQuery = query(
      collection(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION),
      where('unitNumber', '==', unitNumber),
      orderBy('visitDate', 'desc')
    );
    const snapshot = await getDocs(visitsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      buildingId,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting visits by unit:', error);
    throw error;
  }
}

/**
 * Get a single visit by ID
 * @param {string} buildingId - Building ID
 * @param {string} visitId - Visit ID
 * @returns {Promise<Object|null>} Visit data or null if not found
 */
export async function getVisit(buildingId, visitId) {
  try {
    const visitRef = doc(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION, visitId);
    const visitSnap = await getDoc(visitRef);

    if (visitSnap.exists()) {
      return {
        id: visitSnap.id,
        buildingId,
        ...visitSnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting visit:', error);
    throw error;
  }
}

/**
 * Update a visit
 * @param {string} buildingId - Building ID
 * @param {string} visitId - Visit ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateVisit(buildingId, visitId, updates) {
  try {
    const visitRef = doc(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION, visitId);
    await updateDoc(visitRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating visit:', error);
    throw error;
  }
}

/**
 * Delete a visit
 * @param {string} buildingId - Building ID
 * @param {string} visitId - Visit ID
 * @returns {Promise<void>}
 */
export async function deleteVisit(buildingId, visitId) {
  try {
    const visitRef = doc(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION, visitId);
    await deleteDoc(visitRef);

    // Decrement building's visitCount
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    const building = await getDoc(buildingRef);
    const currentCount = building.data()?.visitCount || 0;

    await updateDoc(buildingRef, {
      visitCount: Math.max(0, currentCount - 1),
    });
  } catch (error) {
    console.error('Error deleting visit:', error);
    throw error;
  }
}
