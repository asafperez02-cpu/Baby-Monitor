import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrjTKgdOoPxV18vbVxImfy7rBqnxQfcYY",
  authDomain: "baby-monitor-57bb9.firebaseapp.com",
  projectId: "baby-monitor-57bb9",
  storageBucket: "baby-monitor-57bb9.firebasestorage.app",
  messagingSenderId: "143290491509",
  appId: "1:143290491509:web:352c1e25b01c7bde710e3c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
