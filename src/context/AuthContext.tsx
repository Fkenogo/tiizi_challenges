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
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth } from '../lib/firebaseAuth';
import { db } from '../lib/firebaseDb';

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
const USER_SYNC_KEY_PREFIX = 'tiizi_user_sync';
const USER_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AuthProfile) : null;
  });
  const [isReady, setIsReady] = useState(false);

  const shouldSyncUserDocument = (uid: string) => {
    const key = `${USER_SYNC_KEY_PREFIX}:${uid}`;
    const lastRaw = localStorage.getItem(key);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (!Number.isFinite(last) || Date.now() - last > USER_SYNC_INTERVAL_MS) {
      localStorage.setItem(key, String(Date.now()));
      return true;
    }
    return false;
  };

  const ensureUserDocument = async (firebaseUser: FirebaseUser, preferredDisplayName?: string) => {
    const email = firebaseUser.email ?? 'user@tiizi.app';
    const displayName =
      preferredDisplayName?.trim() ||
      firebaseUser.displayName ||
      email.split('@')[0] ||
      'Tiizi User';

    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        email,
        displayName,
        photoURL: firebaseUser.photoURL ?? null,
        status: 'active',
        emailVerified: firebaseUser.emailVerified ?? false,
        createdAt: Timestamp.now(),
        lastActive: Timestamp.now(),
        stats: {
          level: 1,
          totalPoints: 0,
          totalWorkouts: 0,
          totalChallenges: 0,
          challengesCompleted: 0,
          totalGroups: 0,
        },
      },
      { merge: true },
    );
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        persistProfile(profileFromFirebaseUser(nextUser));
        if (shouldSyncUserDocument(nextUser.uid)) {
          void ensureUserDocument(nextUser).catch((error) => {
            console.error('Failed to bootstrap user document:', error);
          });
        }
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
      if (shouldSyncUserDocument(result.user.uid)) {
        void ensureUserDocument(result.user).catch((error) => {
          console.error('Failed to bootstrap user document:', error);
        });
      }
    } catch (error) {
      // Popup can be blocked on some mobile browser contexts.
      await signInWithRedirect(auth, provider);
    }
  };

  const login = async (email: string, password?: string) => {
    if (password) {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      persistProfile(profileFromFirebaseUser(credentials.user));
      if (shouldSyncUserDocument(credentials.user.uid)) {
        void ensureUserDocument(credentials.user).catch((error) => {
          console.error('Failed to bootstrap user document:', error);
        });
      }
    }
  };

  const signup = async (displayName: string, email: string, password?: string) => {
    if (password) {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      const nextProfile = { displayName: displayName || 'Tiizi User', email };
      persistProfile(nextProfile);
      if (shouldSyncUserDocument(credentials.user.uid)) {
        void ensureUserDocument(credentials.user, displayName).catch((error) => {
          console.error('Failed to bootstrap user document:', error);
        });
      }
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
