// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';


const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

function isPopupLikelyBlocked() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

async function ensureProfile(user, fallbackRole = 'volunteer') {
  // Make sure a Firestore /users/{uid} exists
  const existing = await getUserProfile(user.uid);
  if (!existing) {
    await createUserProfile(user.uid, {
      email: user.email ?? null,
      role: fallbackRole,
      displayName: user.displayName ?? null,
      isActive: true,
      teamId: null,
      routeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function signInWithGoogleReturningNew() {
  let result;
  if (isPopupLikelyBlocked()) {
    await signInWithRedirect(auth, googleProvider);
    return { user: null, isNew: null, viaRedirect: true };
  } else {
    result = await signInWithPopup(auth, googleProvider);
  }
  const info = getAdditionalUserInfo(result);
  // Do NOT create profile here—UI will decide role if new.
  return { user: result.user, isNew: !!info?.isNewUser, viaRedirect: false };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [routeId, setRouteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  /* --------- API --------- */

  // Email/password signup
  async function signup(email, password, userRole = 'volunteer', displayName = null, tId = null, rId = null) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(cred.user.uid, {
      email,
      role: userRole,
      displayName,
      teamId: tId,
      routeId: rId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return cred;
  }

  // Email/password login (verifies Firestore profile exists)
  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(cred.user.uid);
    if (!profile) {
      // hard stop to prevent “Missing or insufficient permissions”
      await signOut(auth);
      throw new Error('User profile not found. Please contact an administrator.');
    }
    return cred;
  }

  function logout() {
    return signOut(auth);
  }

  async function resetPassword(email) {
    const actionSettings = {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    };
    await sendPasswordResetEmail(auth, email, actionSettings);
  }

  // Google OAuth (popup on desktop; redirect on iOS Safari)
  async function signInWithGoogle(desiredRole = 'volunteer') {
    try {
      let result;
      if (isPopupLikelyBlocked()) {
        await signInWithRedirect(auth, googleProvider);
        return; // we’ll finish after redirect
      } else {
        result = await signInWithPopup(auth, googleProvider);
      }
      // If profile exists, ensureProfile is a no-op.
      // If no profile, it will create one using desiredRole.
      await ensureProfile(result.user, desiredRole);
      return result.user;
    } catch (e) {
      console.error('Google sign-in error:', e);
      throw e;
    }
  }

  /* --------- Listeners --------- */

  // Complete OAuth redirect flows on first load
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (!res?.user) return;
        const info = getAdditionalUserInfo(res);
        // Bubble this state via a custom event so Login page can open the role modal.
        window.dispatchEvent(new CustomEvent('oauth-redirect-finished', {
          detail: { user: res.user, isNew: !!info?.isNewUser }
        }));
      } catch (e) {
        console.error('OAuth redirect result error:', e);
      }
    })();
  }, []);

  // Keep app state in sync with Auth + Firestore profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (!user) {
          setRole(null);
          setTeamId(null);
          setRouteId(null);
          setNeedsProfile(false);
          setLoading(false);
          return;
        }

        const profile = await getUserProfile(user.uid);
        if (!profile) {
          // NEW: block app; Login will complete profile (role picker)
          setNeedsProfile(true);
        } else {
          setNeedsProfile(false);
          setRole(profile.role ?? null);
          setTeamId(profile.teamId ?? null);
          setRouteId(profile.routeId ?? null);
        }
      } catch (err) {
        console.error('Auth/profile sync error:', err);
        await signOut(auth);
        setCurrentUser(null);
        setRole(null);
        setTeamId(null);
        setRouteId(null);
        setNeedsProfile(false);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const value = {
    currentUser,
    role,
    teamId,
    routeId,
    signup,
    login,
    logout,
    resetPassword,
    signInWithGoogle,
    signInWithGoogleReturningNew,
    loading,
    needsProfile,
    setNeedsProfile,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
