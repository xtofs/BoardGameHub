import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { firebaseConfig } from "./config";

// Singleton Firebase app + Realtime Database handle, shared by all pages.
export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);

export function isFirebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some(
    (v) => typeof v === "string" && v.includes("REPLACE_ME"),
  );
}
