// Firebase project settings for Kooltek.
// Get these from Firebase Console → Project settings → General → Your apps → Web app.
// While apiKey is "REPLACE_ME", the portal runs in DEMO MODE: accounts and job
// requests are saved only in the current browser (good for previews, not for real use).
export const firebaseConfig = {
  apiKey: "AIzaSyCSQkF6eVoRiftuTnBOK5GmcQAiqsoig7I",
  authDomain: "kooltek-ph.firebaseapp.com",
  projectId: "kooltek-ph",
  storageBucket: "kooltek-ph.firebasestorage.app",
  messagingSenderId: "221508303841",
  appId: "1:221508303841:web:0d5e75476eb29583c030a0",
};

// Emails listed here see the Admin view in DEMO MODE only.
// In live mode, admins are set in Firestore (see README).
export const demoAdminEmails = ["admin@kooltek.demo"];
