// ============================================================
// Firebase Configuration
// ============================================================
// Replace the values below with your own Firebase project config.
// You can find these in the Firebase Console:
//   Project Settings > General > Your apps > Firebase SDK snippet
// ============================================================

const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
  measurementId: "__FIREBASE_MEASUREMENT_ID__"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore reference
const db = firebase.firestore();

// Auth reference
const auth = firebase.auth();

// Sign in anonymously — every visitor gets a stable UID
// used to track votes and prevent duplicates.
async function ensureAnonymousAuth() {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await auth.signInAnonymously();
    return cred.user;
  } catch (err) {
    console.error("Anonymous auth failed:", err);
    return null;
  }
}
