import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  async function signup(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    //doc(db, collection Name, document Id)
    //we're defaulting new users to 'leader', otherwise they're probably admins
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      role: 'leader',
      active: true,
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
        //will read the user document in firestore
        const read = await getDoc(doc(db, 'users', user.uid));
        //stores the read into setRole. role will be either admin of leader depending on whats in firestore
        setRole(read.exists() ? read.data().role : null);
      } else { //if no user is signed in, setrole == null
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
