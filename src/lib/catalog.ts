import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Product, Variant, PriceTier } from "./types";

function toProduct(data: DocumentData, id: string): Product {
  return {
    id,
    name: typeof data?.name === "string" ? data.name : "",
    category: typeof data?.category === "string" ? data.category : "",
    active: typeof data?.active === "boolean" ? data.active : true,
    tags: Array.isArray(data?.tags) ? data.tags : [],
    description: typeof data?.description === "string" ? data.description : null,
    createdAt: (data?.createdAt ?? null) as any,
    updatedAt: (data?.updatedAt ?? null) as any,
  };
}

function toVariant(data: DocumentData, id: string): Variant {
  return {
    id,
    sku: typeof data?.sku === "string" ? data.sku : null,
    shape: typeof data?.shape === "string" ? data.shape : "",
    socket: typeof data?.socket === "string" ? data.socket : "",
    color: typeof data?.color === "string" ? data.color : "",
    active: typeof data?.active === "boolean" ? data.active : true,
    imageUrls: Array.isArray(data?.imageUrls) ? data.imageUrls : [],
    priceTiers: Array.isArray(data?.priceTiers) ? (data.priceTiers as PriceTier[]) : [],
    createdAt: (data?.createdAt ?? null) as any,
    updatedAt: (data?.updatedAt ?? null) as any,
  };
}

/* ===================== PRODUCTS ===================== */

export async function listProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProduct(d.data(), d.id));
}

export async function createProduct(input: Pick<Product, "name" | "category" | "active" | "tags" | "description">) {
  const payload: WithFieldValue<any> = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await addDoc(collection(db, "products"), payload);
}

export async function updateProduct(id: string, patch: Partial<Pick<Product, "name" | "category" | "active" | "tags" | "description">>) {
  await updateDoc(doc(db, "products", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProduct(id: string) {
  await deleteDoc(doc(db, "products", id));
}

/* ===================== VARIANTS ===================== */

export async function listVariants(productId: string): Promise<Variant[]> {
  const q = query(collection(db, "products", productId, "variants"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVariant(d.data(), d.id));
}

export async function upsertVariant(
  productId: string,
  variant: Omit<Variant, "createdAt" | "updatedAt">
) {
  const ref = doc(db, "products", productId, "variants", variant.id);
  await setDoc(
    ref,
    {
      ...variant,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeVariant(productId: string, variantId: string) {
  await deleteDoc(doc(db, "products", productId, "variants", variantId));
}
