import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// הגדרות ה-Firebase שימשכו את המשתנים שהזנת ב-Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// אתחול האפליקציה
const app = initializeApp(firebaseConfig);

// ייצוא מסד הנתונים לשימוש בשאר חלקי האפליקציה
export const db = getFirestore(app);
