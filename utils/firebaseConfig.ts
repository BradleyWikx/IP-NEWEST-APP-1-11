
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyCaH8VZJZhuJtMKSjC44VX6QWmPfAdlJ80",
  authDomain: "dinner-theater-booking.firebaseapp.com",
  projectId: "dinner-theater-booking",
  storageBucket: "dinner-theater-booking.firebasestorage.app",
  messagingSenderId: "802367293541",
  appId: "1:802367293541:web:5d2928c0cb6fa2c8bbde8c",
  measurementId: "G-83WTWDTX7V"
};

let app;
let db: any = null;

try {
  // Check if Firebase is already initialized to prevent errors in HMR/Strict Mode
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Initialize Firestore
  // We wrap this specifically because getFirestore can throw if the SDK isn't compatible
  try {
    db = getFirestore(app);
    console.log("🔥 Firestore successfully initialized");
  } catch (firestoreError) {
    console.warn("⚠️ Firestore failed to initialize. Running in offline/fallback mode.", firestoreError);
  }

} catch (e) {
  console.error("❌ Firebase critical initialization error:", e);
}

export { app, db };
