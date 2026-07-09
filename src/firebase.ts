// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9Pa_ekhkCNBxpnIM1BbUS0CMUPiUUxWM",
  authDomain: "tp-akademi-takip.firebaseapp.com",
  projectId: "tp-akademi-takip",
  storageBucket: "tp-akademi-takip.firebasestorage.app",
  messagingSenderId: "771800700480",
  appId: "1:771800700480:web:b7a9eabf915adea32171a5",
  measurementId: "G-JCH5RVSWNP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app);
