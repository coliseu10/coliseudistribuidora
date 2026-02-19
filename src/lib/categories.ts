import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type Category = {
  id: string;
  name: string;
  order: number; // <<< novo
  createdAt: Timestamp | null;
};

function toCategory(id: string, data: DocumentData): Category {
  const name = typeof data?.name === "string" ? data.name : "";
  const order = typeof data?.order === "number" ? data.order : 999999; // fallback
  const createdAt = (data?.createdAt ?? null) as Timestamp | null;

  return { id, name, order, createdAt };
}

export async function listCategories(): Promise<Category[]> {
  // ordena pelo campo "order" (principal)
  const q = query(collection(db, "categories"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toCategory(d.id, d.data()));
}

export async function createCategory(name: string, order: number): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  await addDoc(collection(db, "categories"), {
    name: trimmed,
    order,
    createdAt: serverTimestamp(),
  });
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  await updateDoc(doc(db, "categories", id), { name: trimmed });
}

export async function setCategoryOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "categories", id), { order });
}

export async function removeCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "categories", id));
}
