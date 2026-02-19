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

export type ProductColor = {
  name: string; // "Branco", "Preto Fosco"
  hex: string;  // "#ffffff"
};

export type ProductDoc = {
  name: string;
  category: string;
  active: boolean;

  sku: string;
  description: string;

  unit: "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";
  packQty: number | null;

  colors: ProductColor[]; // <<< NOVO (múltiplas cores)

  imageUrl: string;
  imagePath: string;

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

function coerceProductDoc(data: DocumentData): ProductDoc {
  const colors: ProductColor[] = [];

  // novo formato
  if (Array.isArray(data?.colors)) {
    for (const it of data.colors) {
      const c = toProductColor(it);
      if (c) colors.push(c);
    }
  }

  // opcional: migração suave se existir "color" antigo como string
  if (colors.length === 0 && typeof (data as Record<string, unknown>)?.color === "string") {
    const legacy = String((data as Record<string, unknown>).color).trim();
    if (legacy) colors.push({ name: legacy, hex: "#000000" });
  }

  return {
    name: typeof data?.name === "string" ? data.name : "",
    category: typeof data?.category === "string" ? data.category : "",
    active: typeof data?.active === "boolean" ? data.active : true,

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

    imageUrl: typeof data?.imageUrl === "string" ? data.imageUrl : "",
    imagePath: typeof data?.imagePath === "string" ? data.imagePath : "",

    createdAt: (data?.createdAt ?? null) as Timestamp | null,
    updatedAt: (data?.updatedAt ?? null) as Timestamp | null,
  };
}

export async function listProducts(): Promise<Product[]> {
  const q = query(
    collection(db, "products"),
    orderBy("createdAt", "desc"),
    limit(200)
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
  patch: Partial<ProductInput>
): Promise<void> {
  await updateDoc(doc(db, "products", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}
