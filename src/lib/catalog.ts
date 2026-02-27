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
  type Timestamp,
  type FieldValue,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Product, Variant, PriceTier } from "./types";

/**
 * Firestore timestamps no retorno podem vir como Timestamp (ou null).
 * serverTimestamp() é FieldValue.
 */
type MaybeTimestamp = Timestamp | null;
type TimestampLike = Timestamp | FieldValue | null;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isPriceTierArray(v: unknown): v is PriceTier[] {
  // Mantém a lógica/estrutura: só garante que é array.
  // Se quiser validar o shape do PriceTier, dá pra reforçar aqui sem mudar o resto.
  return Array.isArray(v);
}

function toProduct(data: DocumentData, id: string): Product {
  return {
    id,
    name: typeof data?.name === "string" ? data.name : "",
    category: typeof data?.category === "string" ? data.category : "",
    active: typeof data?.active === "boolean" ? data.active : true,
    tags: isStringArray(data?.tags) ? data.tags : [],
    description: typeof data?.description === "string" ? data.description : null,
    createdAt: (data?.createdAt ?? null) as MaybeTimestamp,
    updatedAt: (data?.updatedAt ?? null) as MaybeTimestamp,
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
    imageUrls: isStringArray(data?.imageUrls) ? data.imageUrls : [],
    priceTiers: isPriceTierArray(data?.priceTiers) ? (data.priceTiers as PriceTier[]) : [],
    createdAt: (data?.createdAt ?? null) as MaybeTimestamp,
    updatedAt: (data?.updatedAt ?? null) as MaybeTimestamp,
  };
}

/* ===================== PRODUCTS ===================== */

export async function listProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProduct(d.data(), d.id));
}

export async function createProduct(
  input: Pick<Product, "name" | "category" | "active" | "tags" | "description">
) {
  const payload: WithFieldValue<
    Pick<Product, "name" | "category" | "active" | "tags" | "description"> & {
      createdAt: TimestampLike;
      updatedAt: TimestampLike;
    }
  > = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, "products"), payload);
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, "name" | "category" | "active" | "tags" | "description">>
) {
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
  const q = query(
    collection(db, "products", productId, "variants"),
    orderBy("createdAt", "desc")
  );
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
    } satisfies WithFieldValue<Omit<Variant, "createdAt" | "updatedAt"> & { createdAt: TimestampLike; updatedAt: TimestampLike }>,
    { merge: true }
  );
}

export async function removeVariant(productId: string, variantId: string) {
  await deleteDoc(doc(db, "products", productId, "variants", variantId));
}