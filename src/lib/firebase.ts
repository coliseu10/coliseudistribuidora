import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCe51hwBLwq3_Old6WGgm2Ji6Betr3AF5U",
  authDomain: "distribuidora-coliseu.firebaseapp.com",
  projectId: "distribuidora-coliseu",
  storageBucket: "distribuidora-coliseu.firebasestorage.app",
  messagingSenderId: "886347168185",
  appId: "1:886347168185:web:d1adc1d83dcae2c68bde68",

};

export const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);