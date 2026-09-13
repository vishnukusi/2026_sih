import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim() !== ""
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (typeof window !== "undefined" && isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  } catch (err) {
    console.warn("[Firebase] Initialization error:", err);
  }
}

export { app, auth, googleProvider };

export interface GoogleAuthResult {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}

/**
 * Triggers official Firebase Google Sign-In popup
 */
export async function signInWithGooglePopup(): Promise<GoogleAuthResult> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase configuration missing. Please provide your NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local to enable live Google authentication."
    );
  }

  if (!auth || !googleProvider) {
    // Re-attempt init if delayed
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  }

  const result = await signInWithPopup(auth, googleProvider);
  const user: FirebaseUser = result.user;

  return {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    uid: user.uid,
  };
}

export async function signOutFirebase(): Promise<void> {
  if (auth) {
    await firebaseSignOut(auth).catch(() => {});
  }
}
