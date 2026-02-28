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

// ✅ NOVO: segmento (para Home filtrar)
export type HomeSegment = "iluminacao" | "utensilios";

export type ProductColor = {
  name: string; // "Branco", "Preto Fosco"
  hex: string; // "#ffffff"
};

export type ProductDoc = {
  name: string;
  category: string;
  active: boolean;
  segment: HomeSegment | null;
  sku: string;
  description: string;
  unit: "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";
  packQty: number | null;
  colors: ProductColor[]; // múltiplas cores
  priceCents: number | null;
  imageUrls: string[];
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

// ✅ NOVO: valida e normaliza segment
function toSegment(data: DocumentData): HomeSegment | null {
  const s = data?.segment;
  if (s === "iluminacao" || s === "utensilios") return s;
  return null;
}

function toPriceCents(data: DocumentData): number | null {
  // novo formato
  if (typeof data?.priceCents === "number" && Number.isFinite(data.priceCents)) {
    const v = Math.trunc(data.priceCents);
    return v >= 0 ? v : null;
  }

  // migração suave: se existir "price" antigo como number em reais
  if (typeof data?.price === "number" && Number.isFinite(data.price)) {
    const cents = Math.round(data.price * 100);
    return cents >= 0 ? cents : null;
  }

  return null;
}

function coerceImageUrls(data: DocumentData): { imageUrls: string[]; imageUrl: string } {
  const urls: string[] = [];

  // novo formato
  if (Array.isArray(data?.imageUrls)) {
    for (const it of data.imageUrls) {
      if (typeof it === "string") {
        const u = it.trim();
        if (u) urls.push(u);
      }
    }
  }

  // legado: imageUrl único
  const legacyImageUrl = typeof data?.imageUrl === "string" ? data.imageUrl.trim() : "";
  if (urls.length === 0 && legacyImageUrl) urls.push(legacyImageUrl);

  // garante que imageUrl principal fique alinhado com o primeiro do array
  const main = urls[0] ?? legacyImageUrl ?? "";

  return { imageUrls: urls, imageUrl: main };
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
  if (
    colors.length === 0 &&
    typeof (data as Record<string, unknown>)?.color === "string"
  ) {
    const legacy = String((data as Record<string, unknown>).color).trim();
    if (legacy) colors.push({ name: legacy, hex: "#000000" });
  }

  const { imageUrls, imageUrl } = coerceImageUrls(data);
  const priceCents = toPriceCents(data);
  const segment = toSegment(data); // ✅ NOVO

  return {
    name: typeof data?.name === "string" ? data.name : "",
    category: typeof data?.category === "string" ? data.category : "",
    active: typeof data?.active === "boolean" ? data.active : true,

    // ✅ NOVO
    segment,

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

    priceCents,

    imageUrls,
    imageUrl,

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
  // garante compat: se imageUrls vier vazio mas imageUrl vier preenchido (ou vice-versa)
  const normalizedImageUrls =
    Array.isArray(input.imageUrls) && input.imageUrls.length
      ? input.imageUrls
      : input.imageUrl
      ? [input.imageUrl]
      : [];

  const mainImageUrl = normalizedImageUrls[0] ?? input.imageUrl ?? "";

  await addDoc(collection(db, "products"), {
    ...input,
    imageUrls: normalizedImageUrls,
    imageUrl: mainImageUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductInput>
): Promise<void> {
  // se vier imageUrls no patch, mantém imageUrl principal alinhado
  const nextPatch: Record<string, unknown> = { ...patch };

  if ("imageUrls" in patch) {
    const arr =
      Array.isArray(patch.imageUrls) && patch.imageUrls.length
        ? patch.imageUrls
        : [];

    // se alguém mandar imageUrl sem mandar imageUrls, também ok (não força)
    const mainFromArray = arr[0] ?? "";

    nextPatch.imageUrls = arr;

    if (mainFromArray) {
      nextPatch.imageUrl = mainFromArray;
    }
  }

  await updateDoc(doc(db, "products", id), {
    ...nextPatch,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}