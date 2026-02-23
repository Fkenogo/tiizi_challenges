import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

type AuthProfile = {
  displayName: string;
  email: string;
};

type AuthContextValue = {
  user: FirebaseUser | null;
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (displayName: string, email: string, password?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const PROFILE_KEY = 'tiizi_profile';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AuthProfile) : null;
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        persistProfile(profileFromFirebaseUser(nextUser));
      }
      setIsReady(true);
    });
  }, []);

  const persistProfile = (nextProfile: AuthProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
  };

  const profileFromFirebaseUser = (firebaseUser: FirebaseUser, fallbackEmail = 'user@tiizi.app'): AuthProfile => {
    const email = firebaseUser.email ?? fallbackEmail;
    const displayName = firebaseUser.displayName ?? email.split('@')[0] ?? 'Tiizi User';
    return { email, displayName };
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      persistProfile(profileFromFirebaseUser(result.user));
    } catch (error) {
      // Popup can be blocked on some mobile browser contexts.
      await signInWithRedirect(auth, provider);
    }
  };

  const login = async (email: string, password?: string) => {
    if (password) {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      persistProfile(profileFromFirebaseUser(credentials.user));
    }
  };

  const signup = async (displayName: string, email: string, password?: string) => {
    if (password) {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      const nextProfile = { displayName: displayName || 'Tiizi User', email };
      persistProfile(nextProfile);
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAuthenticated: !!user,
      isReady,
      login,
      signup,
      loginWithGoogle,
      logout,
    }),
    [user, profile, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
