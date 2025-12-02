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
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  validateName,
  validateAge,
  validatePhone,
  validateText,
  sanitizeString,
  ValidationError,
} from '../utils/validation.js';
import { handleOfflineWrite } from '../utils/offlineErrorHandler.js';

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
  // Validate and sanitize inputs first (before any async operations)
  const sanitizedName = validateName(buildingData.name, {
    required: true,
    minLength: 1,
    maxLength: 100,
    fieldName: 'Building name',
  });

  const sanitizedAddress = buildingData.address
    ? validateText(buildingData.address, {
        required: false,
        maxLength: 500,
        fieldName: 'Building address',
      }) || ''
    : '';

  const sanitizedUnits = (buildingData.units || [])
    .map((unit) => {
      return sanitizeString(unit, {
        maxLength: 20,
        allowEmpty: false,
      });
    })
    .filter((unit) => unit !== null && unit !== '');

  // Generate temporary ID for offline optimistic response
  const tempId = `temp_building_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const optimisticData = {
    id: tempId,
    name: sanitizedName,
    address: sanitizedAddress,
    routeId: buildingData.routeId,
    communityId: buildingData.communityId,
    teamId: buildingData.teamId,
    units: sanitizedUnits,
    createdBy,
    createdAt: new Date(),
    lastVisitDate: null,
    visitCount: 0,
    isActive: true,
  };

  try {
    return await handleOfflineWrite(async () => {
      // Check for duplicate building name within the same community
      const duplicateQuery = query(
        collection(db, BUILDINGS_COLLECTION),
        where('communityId', '==', buildingData.communityId),
        where('name', '==', sanitizedName),
        where('isActive', '==', true)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        throw new Error(
          `A building with the name "${sanitizedName}" already exists in this community`
        );
      }

      const buildingRef = await addDoc(collection(db, BUILDINGS_COLLECTION), {
        name: sanitizedName,
        address: sanitizedAddress,
        routeId: buildingData.routeId,
        communityId: buildingData.communityId,
        teamId: buildingData.teamId,
        units: sanitizedUnits,
        createdBy,
        createdAt: serverTimestamp(),
        lastVisitDate: null,
        visitCount: 0,
        isActive: true,
      });

      return {
        id: buildingRef.id,
        name: sanitizedName,
        address: sanitizedAddress,
        routeId: buildingData.routeId,
        communityId: buildingData.communityId,
        teamId: buildingData.teamId,
        units: sanitizedUnits,
      };
    }, optimisticData);
  } catch (error) {
    console.error('Error creating building:', error);
    if (error instanceof ValidationError) {
      throw new Error(`Invalid building data: ${error.message}`);
    }
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
 * @param {boolean} preferCache - If true, try cache first for faster offline performance
 * @returns {Promise<Array>} Array of buildings in the route
 */
export async function getBuildingsByRoute(routeId, preferCache = false) {
  try {
    const buildingsQuery = query(
      collection(db, BUILDINGS_COLLECTION),
      where('routeId', '==', routeId),
      where('isActive', '==', true),
      orderBy('name')
    );

    // Use cache-first when offline for instant response
    const options = preferCache ? { source: 'cache' } : {};
    const snapshot = await getDocs(buildingsQuery, options);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If cache fetch fails, fall back to default (network + cache)
    if (error.code === 'unavailable' && preferCache) {
      console.log('Cache miss for buildings, falling back to network');
      const snapshot = await getDocs(buildingsQuery);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
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

    // Check for the duplicated unit number in the building
    if (units.includes(unitNumber)) {
      throw new Error(`Unit "${unitNumber}" already exists in this building`);
    }

    units.push(unitNumber);
    await updateBuilding(buildingId, { units });
  } catch (error) {
    console.error('Error adding unit:', error);
    throw error;
  }
}

/**
 * Hard delete a building and all its visits (PERMANENT)
 * WARNING: This permanently deletes the building document and all visit subcollections
 * Uses batch operations for all-or-nothing deletion
 * @param {string} buildingId - Building ID
 * @returns {Promise<void>}
 */
export async function deleteBuilding(buildingId) {
  try {
    // Get all visits in the subcollection
    const visitsRef = collection(
      db,
      BUILDINGS_COLLECTION,
      buildingId,
      VISITS_SUBCOLLECTION
    );
    const visitsSnapshot = await getDocs(visitsRef);

    // Collect all document references to delete
    const docRefsToDelete = [];

    // Add all visit document references
    visitsSnapshot.docs.forEach((visitDoc) => {
      docRefsToDelete.push(
        doc(db, BUILDINGS_COLLECTION, buildingId, VISITS_SUBCOLLECTION, visitDoc.id)
      );
    });

    // Add the building document reference
    docRefsToDelete.push(doc(db, BUILDINGS_COLLECTION, buildingId));

    // Perform atomic batch delete
    const { batchDelete } = await import('./batchHelpers.js');
    const result = await batchDelete(docRefsToDelete);

    console.log(`✅ Deleted building ${buildingId} with ${result.deletedCount - 1} visits using ${result.batchCount} batch(es)`);
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
 * @param {string} visitData.routeLeaderId - Route leader user ID (optional)
 * @param {Array<Object>} visitData.people - Array of people met during visit
 * @param {string} visitData.people[].name - Person's name (required)
 * @param {number} visitData.people[].age - Person's age (optional)
 * @param {string} visitData.people[].phone - Person's phone (optional)
 * @param {string} visitData.people[].followUp - Follow-up notes for this person (optional)
 * @param {string} visitData.people[].involvement - Current involvement level (optional)
 * @param {string} visitData.notes - General visit notes
 * @param {Array<string>} visitData.photoUrls - Photo URLs (optional)
 * @param {string} createdBy - User ID of creator
 * @returns {Promise<Object>} Created visit with ID
 */
export async function createVisit(buildingId, visitData, createdBy) {
  try {
    // Validate that at least one person is provided
    if (!visitData.people || visitData.people.length === 0) {
      throw new Error('At least one person is required for a visit');
    }

    // Validate and sanitize each person's data
    const sanitizedPeople = visitData.people.map((person, index) => {
      try {
        // Validate name (required)
        const name = validateName(person.name, {
          required: true,
          maxLength: 100,
          fieldName: `Person ${index + 1} name`,
        });

        // Validate age (optional)
        const age = validateAge(person.age, { required: false });

        // Validate phone (optional)
        const phone = validatePhone(person.phone, { required: false });

        // Validate follow-up notes (optional)
        const followUp =
          validateText(person.followUp, {
            required: false,
            maxLength: 500,
            fieldName: 'Follow-up notes',
          }) || '';

        // Validate involvement (optional)
        const involvement =
          validateText(person.involvement, {
            required: false,
            maxLength: 500,
            fieldName: 'Involvement',
          }) || '';

        return { name, age, phone, followUp, involvement };
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new Error(`Invalid person data: ${err.message}`);
        }
        throw err;
      }
    });

    // Validate and sanitize the unit number
    const unitNumber = sanitizeString(visitData.unitNumber, {
      maxLength: 20,
      allowEmpty: false,
    });

    if (!unitNumber) {
      throw new Error('Unit number is required');
    }

    // Validate and sanitize notes (2000 char limit to prevent abuse)
    const notes =
      validateText(visitData.notes, {
        required: false,
        maxLength: 2000,
        fieldName: 'Visit notes',
      }) || '';

    // Fetch building data to get hierarchy fields (teamId, routeId, communityId)
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    const buildingSnap = await getDoc(buildingRef);

    if (!buildingSnap.exists()) {
      throw new Error('Building not found');
    }

    const buildingData = buildingSnap.data();
    const currentCount = buildingData?.visitCount || 0;

    // Fetch parent entity names for denormalization (performance optimization)
    // This prevents N+1 query problem when loading visit history
    const { getRoute } = await import('./routeService.js');
    const { getCommunity } = await import('./communityService.js');
    const { getTeam } = await import('./teamService.js');

    const [routeData, communityData, teamData] = await Promise.all([
      getRoute(buildingData.routeId),
      getCommunity(buildingData.communityId),
      getTeam(buildingData.teamId),
    ]);

    const visitsRef = collection(
      db,
      BUILDINGS_COLLECTION,
      buildingId,
      VISITS_SUBCOLLECTION
    );

    const visitRef = await addDoc(visitsRef, {
      buildingId, // Store parent building reference
      teamId: buildingData.teamId,
      routeId: buildingData.routeId,
      communityId: buildingData.communityId,

      // Denormalized names for performance (prevents N+1 queries in VisitHistory)
      buildingName: buildingData.name || '',
      routeName: routeData?.name || '',
      communityName: communityData?.name || '',
      teamName: teamData?.name || '',

      unitNumber,
      routeLeaderId: visitData.routeLeaderId || null,
      people: sanitizedPeople,
      notes,
      photoUrls: visitData.photoUrls || [],
      visitDate: visitData.visitDate || serverTimestamp(),
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update building's lastVisitDate and visitCount
    await updateDoc(buildingRef, {
      lastVisitDate: serverTimestamp(),
      visitCount: currentCount + 1,
    });

    return {
      id: visitRef.id,
      buildingId,
      teamId: buildingData.teamId,
      routeId: buildingData.routeId,
      communityId: buildingData.communityId,
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
    const visitRef = doc(
      db,
      BUILDINGS_COLLECTION,
      buildingId,
      VISITS_SUBCOLLECTION,
      visitId
    );
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
    const visitRef = doc(
      db,
      BUILDINGS_COLLECTION,
      buildingId,
      VISITS_SUBCOLLECTION,
      visitId
    );
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
    const visitRef = doc(
      db,
      BUILDINGS_COLLECTION,
      buildingId,
      VISITS_SUBCOLLECTION,
      visitId
    );
    await deleteDoc(visitRef);

    // Decrement the building's visitCount and reset lastVisitDate if needed
    const buildingRef = doc(db, BUILDINGS_COLLECTION, buildingId);
    const building = await getDoc(buildingRef);
    const currentCount = building.data()?.visitCount || 0;
    const newCount = Math.max(0, currentCount - 1);

    // If this was the last visit, we need to reset lastVisitDate
    if (newCount === 0) {
      await updateDoc(buildingRef, {
        visitCount: 0,
        lastVisitDate: null, // Reset to null when no visits remain
      });
    } else {
      // If there are still visits, update the count and find the most recent visit date
      const visitsRef = collection(
        db,
        BUILDINGS_COLLECTION,
        buildingId,
        VISITS_SUBCOLLECTION
      );
      const visitsQuery = query(
        visitsRef,
        orderBy('visitDate', 'desc'),
        limit(1)
      );
      const visitsSnapshot = await getDocs(visitsQuery);

      const updateData = {
        visitCount: newCount,
      };

      // Update lastVisitDate to the most recent remaining visit
      if (!visitsSnapshot.empty) {
        const mostRecentVisit = visitsSnapshot.docs[0].data();
        updateData.lastVisitDate = mostRecentVisit.visitDate;
      }

      await updateDoc(buildingRef, updateData);
    }
  } catch (error) {
    console.error('Error deleting visit:', error);
    throw error;
  }
}

// Helper Functions for Visit People

/**
 * Extract the people from the most recent visit at a specific unit
 * Return people from only the latest visit to reflect the current state
 * @param {string} buildingId
 * @param {string} unitNumber
 * @returns {Promise<Array<Object>>} Array of people from the most recent visit
 */
export async function getPastPeopleAtUnit(buildingId, unitNumber) {
  try {
    const visits = await getVisitsByUnit(buildingId, unitNumber);

    // If no visits, return empty array
    if (visits.length === 0) {
      return [];
    }

    // Visits are already sorted by visitDate (most recent first)
    // Get people from the most recent visit only
    const mostRecentVisit = visits[0];
    const people = mostRecentVisit.people || [];

    // Return people with consistent structure (remove visitCount since we're not merging)
    return people.map((person) => ({
      name: person.name,
      age: person.age || null,
      phone: person.phone || '',
      followUp: person.followUp || '',
      involvement: person.involvement || '',
    }));
  } catch (error) {
    console.error('Error getting past people at unit:', error);
    throw error;
  }
}

/**
 * Get all people across all visits in a building
 * @param {string} buildingId - Building ID
 * @returns {Promise<Array<Object>>} Array of unique people
 */
export async function getAllPeopleInBuilding(buildingId) {
  try {
    const visits = await getBuildingVisits(buildingId);

    // Extract all people from all visits
    const allPeople = visits.flatMap((visit) => visit.people || []);

    // Group people by name (not case-sensitive)
    const peopleMap = {};

    allPeople.forEach((person) => {
      const normalizedName = person.name.toLowerCase().trim();

      if (!peopleMap[normalizedName]) {
        peopleMap[normalizedName] = {
          name: person.name,
          age: person.age || null,
          phone: person.phone || '',
          followUp: person.followUp || '',
          involvement: person.involvement || '',
          visitCount: 1,
        };
      } else {
        const existing = peopleMap[normalizedName];
        existing.age = existing.age || person.age || null;
        existing.phone = existing.phone || person.phone || '';
        existing.followUp = existing.followUp || person.followUp || '';
        existing.involvement = existing.involvement || person.involvement || '';
        existing.visitCount += 1;
      }
    });

    return Object.values(peopleMap).sort((a, b) => b.visitCount - a.visitCount);
  } catch (error) {
    console.error('Error getting all people in building:', error);
    throw error;
  }
}
