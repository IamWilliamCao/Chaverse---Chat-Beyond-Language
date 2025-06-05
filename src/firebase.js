// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCp7LIk6mu4qICyahosczKerRk60Ml7AP4",
  authDomain: "realtimethreadapp.firebaseapp.com",
  projectId: "realtimethreadapp",
  storageBucket: "realtimethreadapp.appspot.com",
  messagingSenderId: "446807307061",
  appId: "1:446807307061:web:071c29603bcae76db1127c",
  measurementId: "G-Q8HTFVTDSQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore (Database)
const db = getFirestore(app);

// Authentication
const auth = getAuth(app);

// Storage
const storage = getStorage(app);

export { db, auth, storage };
