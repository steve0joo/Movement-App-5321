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
  const [loading, setLoading] = useState(true);

  // Sign up
  // Role: 'volunteer' | 'leader' | 'admin'
  async function signup(email, password, userRole = 'volunteer', displayName = null) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Create user profile in Firestore using userService
    await createUserProfile(cred.user.uid, {
      email,
      role: userRole,
      displayName,
    });
    return cred;
  }

  // Log in
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
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
        // Get user profile from Firestore using userService
        const userProfile = await getUserProfile(user.uid);
        // Set role: 'volunteer' | 'leader' | 'admin'
        setRole(userProfile?.role || null);
      } else {
        // No user signed in
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    role,
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
