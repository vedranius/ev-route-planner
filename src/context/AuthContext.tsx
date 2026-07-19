import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { auth, googleProvider, db, isFirebaseConfigured } from '../config/firebase';
import type { User } from '../types';

const VEHICLES_KEY = 'evrp_vehicles';

function loadLocalVehicles(): any[] {
  try {
    return JSON.parse(localStorage.getItem(VEHICLES_KEY) || '[]');
  } catch {
    return [];
  }
}

interface DemoUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  emailVerified: boolean;
}

interface AuthContextType {
  currentUser: FirebaseUser | DemoUser | null;
  userData: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (data: Partial<User>) => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

const DEMO_USER_KEY = 'evrp_demo_user';
const DEMO_USER_DATA_KEY = 'evrp_demo_user_data';

function getDemoUser(): DemoUser | null {
  const stored = localStorage.getItem(DEMO_USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

function setDemoUser(user: DemoUser | null) {
  if (user) localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(DEMO_USER_KEY);
}

function getDemoUserData(): User | null {
  const stored = localStorage.getItem(DEMO_USER_DATA_KEY);
  return stored ? JSON.parse(stored) : null;
}

function setDemoUserData(data: User | null) {
  if (data) localStorage.setItem(DEMO_USER_DATA_KEY, JSON.stringify(data));
  else localStorage.removeItem(DEMO_USER_DATA_KEY);
}

function createDemoUser(email: string, displayName: string): DemoUser {
  return {
    uid: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email,
    displayName,
    photoURL: null,
    emailVerified: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | DemoUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserDataFirebase = useCallback(async (user: FirebaseUser) => {
    if (!db) {
      // No database - create default user data
      setUserData({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || undefined,
        twoFactorEnabled: false,
        vehicles: loadLocalVehicles(),
        createdAt: Date.now(),
      });
      return;
    }
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        setUserData(snapshot.val() as User);
      } else {
        const newUser: User = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || undefined,
          twoFactorEnabled: false,
          vehicles: loadLocalVehicles(),
          createdAt: Date.now(),
        };
        await set(userRef, newUser);
        setUserData(newUser);
      }
    } catch (err) {
      console.error('Firebase read failed, using local data:', err);
      setUserData({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || undefined,
        twoFactorEnabled: false,
        vehicles: loadLocalVehicles(),
        createdAt: Date.now(),
      });
    }
  }, []);

  const loadUserDataDemo = useCallback((user: DemoUser) => {
    let data = getDemoUserData();
    if (!data) {
      data = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: false,
        vehicles: [],
        createdAt: Date.now(),
      };
      setDemoUserData(data);
    }
    setUserData(data);
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        try {
          if (user) {
            await loadUserDataFirebase(user);
          } else {
            setUserData(null);
          }
        } catch (err) {
          console.error('Error loading user data:', err);
          // Still set some default data so app works
          if (user) {
            setUserData({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              twoFactorEnabled: false,
              vehicles: [],
              createdAt: Date.now(),
            });
          }
        } finally {
          setLoading(false);
        }
      });
      return unsubscribe;
    } else {
      const demoUser = getDemoUser();
      setCurrentUser(demoUser);
      if (demoUser) {
        loadUserDataDemo(demoUser);
      }
      setLoading(false);
    }
  }, [loadUserDataFirebase, loadUserDataDemo]);

  const login = async (email: string, password: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const demoUser = getDemoUser();
      if (demoUser && demoUser.email === email) {
        setCurrentUser(demoUser);
        loadUserDataDemo(demoUser);
        return;
      }
      const newUser = createDemoUser(email, email.split('@')[0]);
      setDemoUser(newUser);
      setCurrentUser(newUser);
      loadUserDataDemo(newUser);
    }
  };

  const register = async (email: string, _password: string, displayName: string) => {
    if (isFirebaseConfigured && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, _password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
      if (db) {
        await update(ref(db, `users/${cred.user.uid}`), {
          displayName,
          email,
          createdAt: Date.now(),
        });
      }
    } else {
      const newUser = createDemoUser(email, displayName);
      setDemoUser(newUser);
      setCurrentUser(newUser);
      const userData: User = {
        uid: newUser.uid,
        email,
        displayName,
        twoFactorEnabled: false,
        vehicles: [],
        createdAt: Date.now(),
      };
      setDemoUserData(userData);
      setUserData(userData);
    }
  };

  const loginWithGoogle = async () => {
    if (isFirebaseConfigured && auth && googleProvider) {
      await signInWithPopup(auth, googleProvider);
    } else {
      const newUser = createDemoUser('demo@evrplanner.com', 'Demo User');
      setDemoUser(newUser);
      setCurrentUser(newUser);
      loadUserDataDemo(newUser);
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setDemoUser(null);
    setUserData(null);
    setCurrentUser(null);
  };

  const updateUserData = async (data: Partial<User>) => {
    if (isFirebaseConfigured && currentUser && db && 'uid' in currentUser) {
      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, data);
    }
    setUserData((prev) => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) setDemoUserData(updated);
      return updated;
    });
  };

  const sendVerification = async () => {
    if (isFirebaseConfigured && auth && currentUser && 'emailVerified' in currentUser && !currentUser.emailVerified) {
      await sendEmailVerification(currentUser as FirebaseUser);
    }
  };

  const value = {
    currentUser,
    userData,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    updateUserData,
    sendVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
