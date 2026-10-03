import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA7jhmf61X_7uW3JWcMHEvn_Blxz1YNdoM",
  authDomain: "dental-schedule-e1c9b.firebaseapp.com",
  projectId: "dental-schedule-e1c9b",
  storageBucket: "dental-schedule-e1c9b.firebasestorage.app",
  messagingSenderId: "431144232008",
  appId: "1:431144232008:web:b3d96487417f9576cc647d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
