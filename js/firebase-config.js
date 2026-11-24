// Firebase project settings for Kooltek.
// Get these from Firebase Console → Project settings → General → Your apps → Web app.
// While apiKey is "REPLACE_ME", the portal runs in DEMO MODE: accounts and job
// requests are saved only in the current browser (good for previews, not for real use).
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

// Emails listed here see the Admin view in DEMO MODE only.
// In live mode, admins are set in Firestore (see README).
export const demoAdminEmails = ["admin@kooltek.demo"];
