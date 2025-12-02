import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB6VRVyODDkZNjkdcUJAOny45NgMtEyPQQ",
  authDomain: "dybytechvcf.firebaseapp.com",
  databaseURL: "https://dybytechvcf-default-rtdb.firebaseio.com",
  projectId: "dybytechvcf",
  storageBucket: "dybytechvcf.firebasestorage.app",
  messagingSenderId: "201006931483",
  appId: "1:201006931483:web:c7b6532d4bef230ecae2be",
  measurementId: "G-K7QK6ZT4FH"
};

// Initialize Firebase using compat
const app = firebase.initializeApp(firebaseConfig);

// Export compat auth instance
export const auth = firebase.auth();

// Export modular firestore instance (uses default app initialized above)
export const db = getFirestore();

// Export modular storage instance
export const storage = getStorage();