import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const USERS_COLLECTION = 'users';

/**
 * Create or update user profile in Firestore
 * Called after Firebase Auth signup
 *
 * Role hierarchy:
 * - 'volunteer': Basic access, manages data
 * - 'leader': Route leader, manages data and volunteers
 * - 'admin': Administrator, can add/remove route leaders
 */
export async function createUserProfile(userId, userData) {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, {
      email: userData.email,
      role: userData.role || 'volunteer', // 'volunteer' | 'leader' | 'admin'
      siteId: userData.siteId || null,
      displayName: userData.displayName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId) {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

/**
 * Get all route leaders (admin function)
 * Returns all users with their roles
 */
export async function getAllUsers() {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const querySnapshot = await getDocs(usersRef);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

/**
 * Get users by role
 */
export async function getUsersByRole(role) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting users by role:', error);
    throw error;
  }
}

/**
 * Delete route leader (admin function)
 * Note: This only deletes the Firestore profile
 * Firebase Auth account should be deleted separately via Admin SDK
 */
export async function deleteUserProfile(userId) {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
}

/**
 * Update user profile (admin function)
 */
export async function updateUserProfile(userId, updates) {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(userId) {
  try {
    const userProfile = await getUserProfile(userId);
    return userProfile?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if user is route leader or admin
 */
export async function isUserLeaderOrAdmin(userId) {
  try {
    const userProfile = await getUserProfile(userId);
    return userProfile?.role === 'leader' || userProfile?.role === 'admin';
  } catch (error) {
    console.error('Error checking leader status:', error);
    return false;
  }
}

/**
 * Get all volunteers (for route leaders to manage)
 */
export async function getAllVolunteers() {
  try {
    return await getUsersByRole('volunteer');
  } catch (error) {
    console.error('Error getting volunteers:', error);
    throw error;
  }
}

/**
 * Get all route leaders (for admins to manage)
 */
export async function getAllRouteLeaders() {
  try {
    return await getUsersByRole('leader');
  } catch (error) {
    console.error('Error getting route leaders:', error);
    throw error;
  }
}
