import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBNs1mG6fcGpTfZ4f6ywuM6HP1HJco3O7w",
  authDomain: "coliseu-31027.firebaseapp.com",
  projectId: "coliseu-31027",
  storageBucket: "coliseu-31027.firebasestorage.app",
  messagingSenderId: "1024001761998",
  appId: "1:1024001761998:web:2dba46c9aa434e77ada69f",
};

export const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
