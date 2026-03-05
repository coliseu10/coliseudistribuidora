import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// segmento (para Home filtrar)
export type HomeSegment = "iluminacao" | "utensilios";

export type ProductColor = {
  name: string;
  hex: string;
};

export type ProductDoc = {
  name: string;
  brand: string;
  category: string;
  active: boolean;
  segment: HomeSegment | null;
  sku: string;
  description: string;
  unit: "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";
  packQty: number | null;
  colors: ProductColor[];
  priceCents: number | null;
  packPriceCents: number | null;
  imageUrls: string[];
  imagePaths: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type Product = ProductDoc & { id: string };
export type ProductInput = Omit<ProductDoc, "createdAt" | "updatedAt">;

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

function toProductColor(x: unknown): ProductColor | null {
  if (typeof x !== "object" || x === null) return null;
  const obj = x as Record<string, unknown>;

  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const hex = obj.hex;

  if (!name) return null;

  const normalizedHex = isHexColor(hex) ? hex.toLowerCase() : "#000000";
  return { name, hex: normalizedHex };
}

function toSegment(data: DocumentData): HomeSegment | null {
  const s = data?.segment;
  if (s === "iluminacao" || s === "utensilios") return s;
  return null;
}

function toPriceCentsValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 0 ? n : null;
  }
  return null;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const it of v) {
    if (typeof it === "string") {
      const s = it.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function coerceProductDoc(data: DocumentData): ProductDoc {
  const colors: ProductColor[] = [];
  if (Array.isArray(data?.colors)) {
    for (const it of data.colors) {
      const c = toProductColor(it);
      if (c) colors.push(c);
    }
  }

  const imageUrls = toStringArray(data?.imageUrls);
  const imagePaths = toStringArray(data?.imagePaths);

  return {
    name: typeof data?.name === "string" ? data.name : "",
    brand: typeof data?.brand === "string" ? data.brand : "",
    category: typeof data?.category === "string" ? data.category : "",
    active: typeof data?.active === "boolean" ? data.active : true,
    segment: toSegment(data),
    sku: typeof data?.sku === "string" ? data.sku : "",
    description: typeof data?.description === "string" ? data.description : "",

    unit:
      data?.unit === "Unidade" ||
      data?.unit === "Kit" ||
      data?.unit === "Meia Caixa" ||
      data?.unit === "Caixa Fechada" ||
      data?.unit === ""
        ? data.unit
        : "",
    packQty: typeof data?.packQty === "number" ? data.packQty : null,

    colors,

    // unidade
    priceCents: toPriceCentsValue(data?.priceCents),

    // total (novo)
    packPriceCents: toPriceCentsValue(data?.packPriceCents),

    imageUrls,
    imagePaths,

    createdAt: (data?.createdAt ?? null) as Timestamp | null,
    updatedAt: (data?.updatedAt ?? null) as Timestamp | null,
  };
}

export async function listProducts(): Promise<Product[]> {
  const q = query(
    collection(db, "products"),
    orderBy("createdAt", "desc"),
    limit(5000),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...coerceProductDoc(d.data()) }));
}

export async function createProduct(input: ProductInput): Promise<void> {
  await addDoc(collection(db, "products"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductInput>,
): Promise<void> {
  await updateDoc(doc(db, "products", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}