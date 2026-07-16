import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || "configuration-pending",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || "configuration-pending.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || "configuration-pending",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || "configuration-pending.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || "0",
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || "configuration-pending",
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID,
);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.addScope("https://www.googleapis.com/auth/spreadsheets");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.send");
