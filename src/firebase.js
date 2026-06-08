// src/firebase.js
// ─── Inicialización única de Firebase ────────────────────────────────────────
// Importá auth y db desde este archivo en cualquier componente o página.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBOVeqfA4OQiyGfgr9GC6232iUOijJpZpA",
  authDomain: "canchapp-bd546.firebaseapp.com",
  databaseURL: "https://canchapp-bd546-default-rtdb.firebaseio.com",
  projectId: "canchapp-bd546",
  storageBucket: "canchapp-bd546.appspot.com",
  messagingSenderId: "212536933109",
  appId: "1:212536933109:web:375db8ee4b7044063b63bc",
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
