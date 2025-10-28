import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [routeId, setRouteId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign up
  // Role: 'volunteer' | 'route_leader' | 'team_admin' | 'super_admin'
  async function signup(
    email,
    password,
    userRole = 'volunteer',
    displayName = null,
    teamId = null,
    routeId = null
  ) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Create user profile in Firestore using userService
    await createUserProfile(cred.user.uid, {
      email,
      role: userRole,
      displayName,
      teamId,
      routeId,
    });
    return cred;
  }

  // Log in with Firestore profile verification
  async function login(email, password) {
    // First authenticate with Firebase Auth
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Verify user profile exists in Firestore
    const userProfile = await getUserProfile(cred.user.uid);

    if (!userProfile) {
      // User authenticated but has no Firestore profile - sign them out
      await signOut(auth);
      throw new Error(
        'User profile not found. Please sign in or contact an administrator.'
      );
    }

    return cred;
  }

  // Log out
  function logout() {
    return signOut(auth);
  }

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Get user profile from Firestore using userService
          const userProfile = await getUserProfile(user.uid);

          // Check if profile exists
          if (!userProfile) {
            // Auth account exists but no Firestore profile
            // This can happen if:
            // 1. User was deleted from Firestore but Auth account remains
            // 2. Profile creation failed during signup
            console.warn('User authenticated but no Firestore profile found. Logging out.');
            await signOut(auth);
            setRole(null);
            setTeamId(null);
            setRouteId(null);
            setCurrentUser(null);
          } else {
            // Set role: 'volunteer' | 'route_leader' | 'team_admin' | 'super_admin'
            setRole(userProfile.role || null);
            setTeamId(userProfile.teamId || null);
            setRouteId(userProfile.routeId || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // On error, sign out to be safe
          await signOut(auth);
          setRole(null);
          setTeamId(null);
          setRouteId(null);
          setCurrentUser(null);
        }
      } else {
        // No user signed in
        setRole(null);
        setTeamId(null);
        setRouteId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    role,
    teamId,
    routeId,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
