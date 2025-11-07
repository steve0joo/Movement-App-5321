import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
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
  async function signup(
    email,
    password,
    userRole = 'volunteer',
    displayName = null
  ) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Create user profile in Firestore using userService
    await createUserProfile(cred.user.uid, {
      email,
      role: userRole,
      displayName,
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

  function isPopupLikelyBlocked() {
    // iOS Safari + some in-app browsers block popups; use redirect there
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    return isIOS && isSafari;
  }
  
  async function ensureProfile(user, fallbackRole = 'volunteer') {
    const existing = await getUserProfile(user.uid);
    if (!existing) {
      await createUserProfile(user.uid, {
        email: user.email || null,
        role: fallbackRole,
        displayName: user.displayName || null,
      });
    }
  }
  
  async function signInWithGoogle() {
    try {
      let result;
      if (isPopupLikelyBlocked()) {
        await signInWithRedirect(auth, googleProvider);
        return; // we’ll finish after redirect
      } else {
        result = await signInWithPopup(auth, googleProvider);
      }
      await ensureProfile(result.user);
      return result.user;
    } catch (e) {
      console.error('Google sign-in error:', e);
      throw e;
    }
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

  // Handle redirect-completion when the app loads
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          await ensureProfile(res.user);
        }
      } catch (e) {
        console.error('OAuth redirect result error:', e);
      }
    })();
  }, []);

  const value = {
    currentUser,
    role,
    signup,
    login,
    logout,
    loading,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
