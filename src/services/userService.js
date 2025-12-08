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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from './firebase';

const USERS_COLLECTION = 'users';

/**
 * Create or update user profile in Firestore.
 * IMPORTANT: email is taken from auth.currentUser to satisfy rules:
 * request.resource.data.email == request.auth.token.email
 * Role hierarchy:
 * 'volunteer': Basic access, manages data within assigned team
 * 'route_leader': Route leader, manages routes and volunteers within assigned team
 * 'team_admin': Team administrator, manages team data and users (cannot access other teams)
 * 'super_admin': Super administrator, full system access across all teams
 */
export async function createUserProfile(userId, userData = {}) {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const profile = {
      // Ensure rule match
      email: auth.currentUser?.email ?? null,

      // Provided fields (with sensible defaults)
      role: userData.role || 'volunteer',
      teamId: userData.teamId ?? null,
      routeId: userData.routeId ?? null,
      displayName: userData.displayName ?? null,
      isActive: true,

      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, profile, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

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

export async function getAllUsers() {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const querySnapshot = await getDocs(usersRef);
    return querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function getUsersByRole(role) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error getting users by role:', error);
    throw error;
  }
}

export async function deleteUserProfile(userId) {
  try {
    try {
      const functions = getFunctions();
      const deleteUserFunc = httpsCallable(functions, 'deleteUser');
      const result = await deleteUserFunc({ userId });
      if (result.data.success) return { success: true, method: 'cloud-function' };
    } catch (cloudError) {
      console.warn('Cloud Function not available, falling back to Firestore-only deletion:', cloudError.message);
      await deleteDoc(doc(db, USERS_COLLECTION, userId));
      return {
        success: true,
        method: 'firestore-only',
        warning: 'Firebase Auth account not deleted. User can still login but will have no profile.',
      };
    }
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
}

export async function updateUserProfile(userId, updates) {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function isUserAdmin(userId) {
  try {
    const u = await getUserProfile(userId);
    return u?.role === 'super_admin' || u?.role === 'team_admin';
  } catch (e) {
    console.error('Error checking admin status:', e);
    return false;
  }
}

export async function isUserSuperAdmin(userId) {
  try {
    const u = await getUserProfile(userId);
    return u?.role === 'super_admin';
  } catch (e) {
    console.error('Error checking super admin status:', e);
    return false;
  }
}

export async function isUserTeamAdmin(userId) {
  try {
    const u = await getUserProfile(userId);
    return u?.role === 'team_admin';
  } catch (e) {
    console.error('Error checking team admin status:', e);
    return false;
  }
}

export async function isUserLeaderOrAdmin(userId) {
  try {
    const u = await getUserProfile(userId);
    return u?.role === 'route_leader' || u?.role === 'team_admin' || u?.role === 'super_admin';
  } catch (e) {
    console.error('Error checking leader status:', e);
    return false;
  }
}

export async function getAllVolunteers() {
  return getUsersByRole('volunteer');
}

export async function getAllRouteLeaders() {
  return getUsersByRole('route_leader');
}

export async function getUsersByTeam(teamId) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    // Get the users in the specified team OR unassigned users (teamId === null)
    // This allows admins to see and assign unassigned users
    const q1 = query(usersRef, where('teamId', '==', teamId));
    const q2 = query(usersRef, where('teamId', '==', null));

    const [querySnapshot1, querySnapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    const teamUsers = querySnapshot1.docs.map((d) => ({ id: d.id, ...d.data() }));
    const unassignedUsers = querySnapshot2.docs.map((d) => ({ id: d.id, ...d.data() }));

    return [...teamUsers, ...unassignedUsers];
  } catch (error) {
    console.error('Error getting users by team:', error);
    throw error;
  }
}

export async function getAllTeamAdmins() {
  return getUsersByRole('team_admin');
}
