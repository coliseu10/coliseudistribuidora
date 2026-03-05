/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { listCategories, type Category } from "../lib/categorias";
import {
  createProduct,
  listProducts,
  removeProduct,
  updateProduct,
  type ProductColor,
  type HomeSegment,
} from "../lib/produtos";
import type { Product } from "../lib/produtos";
import { uploadProductImage, deleteImageByPath } from "../lib/storageUpload";

export type ProductIntent =
  | { type: "edit"; id: string }
  | { type: "new"; category?: string; segment?: HomeSegment };

type Props = {
  intent?: ProductIntent | null;
  clearIntent?: () => void;
};

type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";

type ImgItem =
  | { kind: "remote"; url: string; path: string }
  | { kind: "local"; url: string; file: File };

type FormState = {
  id?: string;
  name: string;
  brand: string;
  category: string;
  active: boolean;
  segment: HomeSegment | "";
  sku: string;
  description: string;
  unit: UnitOption;
  packQty: string;
  price: string;
  packPrice: string;
  colors: ProductColor[];
  imageUrls: string[];
  imagePaths: string[];
};

const emptyForm: FormState = {
  name: "",
  brand: "",
  category: "",
  active: true,
  segment: "",
  sku: "",
  description: "",
  unit: "Unidade",
  packQty: "",
  price: "",
  packPrice: "",
  colors: [],
  imageUrls: [],
  imagePaths: [],
};

/* ===================== HELPERS (embalagem/validação) ===================== */
function needsPackQty(unit: UnitOption) {
  return unit === "Kit" || unit === "Meia Caixa" || unit === "Caixa Fechada";
}
function packQtyLabel(unit: UnitOption) {
  if (unit === "Kit") return "Quantas peças vem no Kit?";
  if (unit === "Meia Caixa") return "Quantidade da Meia Caixa (peças)";
  if (unit === "Caixa Fechada") return "Quantidade da Caixa Fechada (peças)";
  return "Quantidade";
}
function packPriceLabel(unit: UnitOption) {
  if (unit === "Kit") return "Valor total do Kit (R$)";
  if (unit === "Meia Caixa") return "Valor total da Meia Caixa (R$)";
  if (unit === "Caixa Fechada") return "Valor total da Caixa Fechada (R$)";
  return "Valor total (R$)";
}
function parsePositiveInt(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (n <= 0) return null;
  return n;
}

/* ===================== HELPERS (cores) ===================== */
function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}
function normalizeColorName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

/* ===================== HELPERS (UI) ===================== */
function categoryBadgeClass(): string {
  return "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-600/20";
}
function formatPack(unit: UnitOption, packQty: number | null): string | null {
  if (!unit) return null;
  if (unit === "Unidade") return "Unidade";
  if (packQty && packQty > 0) return `${unit} • ${packQty} peças`;
  return unit;
}

/* ===================== HELPERS (moeda) ===================== */
function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}
function formatBRLInputFromDigits(digits: string) {
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function parseBRLToCents(input: string): number | null {
  const d = digitsOnly(input);
  if (!d) return null;
  const cents = Number(d);
  if (!Number.isFinite(cents)) return null;
  if (cents <= 0) return null;
  return Math.trunc(cents);
}
function formatCentsToBRLInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function formatCentsToBRLCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ===================== HELPERS (arrays) ===================== */
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export default function ProdutosPanel({ intent, clearIntent }: Props) {
  /* ===================== STATE (dados) ===================== */
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  /* ===================== STATE (filtro) ===================== */
  const [q, setQ] = useState("");

  /* ===================== STATE (seleção p/ excluir em massa) ===================== */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function isSelected(id: string) {
    return selectedIds.has(id);
  }
  function toggleSelected(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function selectAllVisible(list: Product[]) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      for (const p of list) next.add(p.id);
      return next;
    });
  }

  /* ===================== STATE (modal/form) ===================== */
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ===================== STATE (imagens) ===================== */
  const [preview, setPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // lista única (remote + local)
  const [imgItems, setImgItems] = useState<ImgItem[]>([]);
  const [deletedRemotePaths, setDeletedRemotePaths] = useState<string[]>([]);

  // drag reorder
  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /* ===================== STATE (cores) ===================== */
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(
    null,
  );

  /* ===================== STATE (validações) ===================== */
  const [priceTouched, setPriceTouched] = useState(false);
  const [packPriceTouched, setPackPriceTouched] = useState(false);

  /* ===================== FOCUS (input cor) ===================== */
  const colorNameRef = useRef<HTMLInputElement | null>(null);
  function focusColorName(selectAll = false) {
    setTimeout(() => {
      const el = colorNameRef.current;
      if (!el) return;
      el.focus();
      if (selectAll) el.select();
    }, 0);
  }

  /* ===================== DATA LOAD ===================== */
  async function reload() {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([listCategories(), listProducts()]);
      setCats(c);
      setItems(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  /* ===================== LOCK BODY SCROLL QUANDO MODAL ABERTO ===================== */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ===================== DERIVED: cats por segmento ===================== */
  const catsForSegment = useMemo(() => {
    const seg = form.segment;
    if (seg !== "iluminacao" && seg !== "utensilios") return [];
    return cats
      .filter((c) => c.segment === seg)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [cats, form.segment]);

  /* ===================== INTENT ===================== */
  useEffect(() => {
    if (!intent) return;
    if (loading) return;

    if (intent.type === "new") {
      if (cats.length === 0) return;
      openNew(intent.category, intent.segment);
      clearIntent?.();
      return;
    }

    if (intent.type === "edit") {
      const p = items.find((x) => x.id === intent.id);
      if (p) openEdit(p);
      else alert("Produto não encontrado na lista.");
      clearIntent?.();
    }
  }, [intent, loading, items, cats, clearIntent]);

  /* ===================== FILTER (inclui marca) ===================== */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((p) => {
      const brand = String((p as Product & { brand?: string }).brand ?? "")
        .toLowerCase()
        .trim();

      const inBase =
        (p.name || "").toLowerCase().includes(s) ||
        (p.category || "").toLowerCase().includes(s) ||
        (p.sku || "").toLowerCase().includes(s) ||
        brand.includes(s);

      const inColors = (p.colors || []).some((c) =>
        (c.name || "").toLowerCase().includes(s),
      );

      return inBase || inColors;
    });
  }, [items, q]);

  const canCreate = cats.length > 0;

  /* ===================== LIMPA SELEÇÃO DE IDS QUE NÃO EXISTEM MAIS ===================== */
  useEffect(() => {
    setSelectedIds((cur) => {
      if (cur.size === 0) return cur;
      const existing = new Set(items.map((p) => p.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of cur) {
        if (existing.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : cur;
    });
  }, [items]);

  /* ===================== MODAL: open/close ===================== */
  function resetColorDrafts() {
    setNewColorName("");
    setNewColorHex("#000000");
    setEditingColorIndex(null);
  }

  function cleanupLocalPreviews(list: ImgItem[]) {
    for (const it of list) {
      if (it.kind === "local") URL.revokeObjectURL(it.url);
    }
  }

  function closeModal() {
    cleanupLocalPreviews(imgItems);
    setOpen(false);
    setPreview("");
    setImgItems([]);
    setDeletedRemotePaths([]);
    resetColorDrafts();
    setPriceTouched(false);
    setPackPriceTouched(false);
  }

  function openNew(categoryOverride?: string, segmentOverride?: HomeSegment) {
    const seg = segmentOverride ?? "";
    const segValid = seg === "iluminacao" || seg === "utensilios" ? seg : "";

    const next: FormState = {
      ...emptyForm,
      unit: "Unidade",
      packQty: "",
      price: "",
      packPrice: "",
      colors: [],
      imageUrls: [],
      imagePaths: [],
      active: true,

      segment: segValid,
      category: "",
      name: "",
      brand: "",
      sku: "",
      description: "",
    };

    if (categoryOverride && segValid) {
      const list = cats
        .filter((c) => c.segment === segValid)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const exists = list.some((c) => c.name === categoryOverride);
      if (exists) next.category = categoryOverride;
    }

    setForm(next);
    setImgItems([]);
    setDeletedRemotePaths([]);
    setPreview("");
    resetColorDrafts();
    setPriceTouched(false);
    setPackPriceTouched(false);
    setOpen(true);
  }

  function openEdit(p: Product) {
    const urls = uniq(Array.isArray(p.imageUrls) ? p.imageUrls : []);
    const paths = uniq(
      Array.isArray((p as Product & { imagePaths?: string[] }).imagePaths)
        ? ((p as Product & { imagePaths?: string[] }).imagePaths as string[])
        : [],
    );

    const seg = (p as Product & { segment?: HomeSegment | null }).segment ?? "";
    const segValid = seg === "iluminacao" || seg === "utensilios" ? seg : "";

    const packPriceCents =
      typeof (p as Product & { packPriceCents?: number | null })
        .packPriceCents === "number"
        ? (p as Product & { packPriceCents?: number | null }).packPriceCents
        : null;

    const next: FormState = {
      id: p.id,
      name: p.name,
      brand: String((p as Product & { brand?: string }).brand ?? ""),
      active: p.active,
      segment: segValid,
      category: p.category,
      sku: p.sku,
      description: p.description,
      unit: p.unit,
      packQty: p.packQty != null ? String(p.packQty) : "",
      price: p.priceCents != null ? formatCentsToBRLInput(p.priceCents) : "",
      packPrice:
        packPriceCents != null ? formatCentsToBRLInput(packPriceCents) : "",
      colors: Array.isArray(p.colors) ? p.colors : [],
      imageUrls: urls,
      imagePaths: paths,
    };

    const remoteItems: ImgItem[] = urls.map((u, i) => ({
      kind: "remote",
      url: u,
      path: typeof paths[i] === "string" ? paths[i] : "",
    }));

    setForm(next);
    setImgItems(remoteItems);
    setDeletedRemotePaths([]);
    setPreview(remoteItems[0]?.url || "");
    resetColorDrafts();
    setPriceTouched(false);
    setPackPriceTouched(false);
    setOpen(true);
  }

  // quando troca segmento, ajusta categoria automaticamente
  useEffect(() => {
    if (!open) return;

    const seg = form.segment;
    if (seg !== "iluminacao" && seg !== "utensilios") {
      if (form.category) setForm((s) => ({ ...s, category: "" }));
      return;
    }

    const list = cats
      .filter((c) => c.segment === seg)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (!form.category) {
      const first = list[0]?.name ?? "";
      if (first) setForm((s) => ({ ...s, category: first }));
      return;
    }

    const exists = list.some((c) => c.name === form.category);
    if (!exists) {
      const first = list[0]?.name ?? "";
      setForm((s) => ({ ...s, category: first }));
    }
  }, [form.segment, cats, open, form.category]);

  /* ===================== CORES ===================== */
  function startEditColor(idx: number) {
    const c = form.colors[idx];
    if (!c) return;
    setEditingColorIndex(idx);
    setNewColorName(c.name);
    setNewColorHex(isHexColor(c.hex) ? c.hex : "#000000");
    focusColorName(true);
  }

  function cancelEditColor() {
    resetColorDrafts();
    focusColorName();
  }

  function upsertColor() {
    const name = normalizeColorName(newColorName);
    const hex = isHexColor(newColorHex) ? newColorHex.toLowerCase() : "#000000";
    if (!name) return;

    setForm((s) => {
      const colors = [...s.colors];

      if (editingColorIndex == null) {
        const exists = colors.some(
          (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (exists) return s;
        return { ...s, colors: [...colors, { name, hex }] };
      }

      if (editingColorIndex < 0 || editingColorIndex >= colors.length) return s;

      const duplicateOther = colors.some((c, i) => {
        if (i === editingColorIndex) return false;
        return c.name.trim().toLowerCase() === name.toLowerCase();
      });
      if (duplicateOther) return s;

      colors[editingColorIndex] = { name, hex };
      return { ...s, colors };
    });

    resetColorDrafts();
    focusColorName();
  }

  function removeColorByIndex(idx: number) {
    setForm((s) => {
      const next = [...s.colors];
      if (idx < 0 || idx >= next.length) return s;
      next.splice(idx, 1);
      return { ...s, colors: next };
    });

    setEditingColorIndex((cur) => {
      if (cur == null) return null;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });

    if (editingColorIndex === idx) {
      resetColorDrafts();
      focusColorName();
    }
  }

  /* ===================== IMAGENS (seleção local, upload só no salvar) ===================== */
  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const locals: ImgItem[] = Array.from(files).map((file) => ({
      kind: "local",
      file,
      url: URL.createObjectURL(file),
    }));

    setImgItems((cur) => [...cur, ...locals]);
    if (!preview && locals[0]?.url) setPreview(locals[0].url);
  }

  function setMainImageByIndex(idx: number) {
    setImgItems((cur) => {
      const next = [...cur];
      if (idx < 0 || idx >= next.length) return cur;
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });

    const u = imgItems[idx]?.url;
    if (u) setPreview(u);
  }

  function moveImage(fromIndex: number, toIndex: number) {
    setImgItems((cur) => {
      const next = [...cur];
      if (fromIndex < 0 || fromIndex >= next.length) return cur;
      if (toIndex < 0 || toIndex >= next.length) return cur;
      if (fromIndex === toIndex) return cur;

      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);

      const nextPreview =
        preview && next.some((x) => x.url === preview)
          ? preview
          : next[0]?.url || "";
      setPreview(nextPreview);

      return next;
    });
  }

  function onDragStartThumb(idx: number) {
    dragFromRef.current = idx;
  }
  function onDragEndThumb() {
    dragFromRef.current = null;
    setDragOverIdx(null);
  }
  function onDragOverThumb(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }
  function onDropThumb(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragFromRef.current;
    dragFromRef.current = null;
    setDragOverIdx(null);
    if (from == null || from === idx) return;
    moveImage(from, idx);
  }

  function removeImageAt(idx: number) {
    setImgItems((cur) => {
      const next = [...cur];
      const item = next[idx];
      if (!item) return cur;

      if (item.kind === "local") {
        URL.revokeObjectURL(item.url);
      } else if (item.path) {
        setDeletedRemotePaths((prev) => [...prev, item.path]);
      }

      next.splice(idx, 1);

      const nextPreview =
        preview === item.url
          ? next[0]?.url || ""
          : preview && next.some((x) => x.url === preview)
            ? preview
            : next[0]?.url || "";

      setPreview(nextPreview);
      return next;
    });
  }

  /* ===================== SAVE (upload aqui) ===================== */
  async function save() {
    setSaving(true);
    try {
      const name = form.name.trim();
      const brand = form.brand.trim();
      const category = form.category.trim();
      if (!name || !category) return;

      const segmentToSave: HomeSegment | null =
        form.segment === "iluminacao" || form.segment === "utensilios"
          ? form.segment
          : null;

      if (!segmentToSave) {
        alert("Selecione o segmento (Iluminação ou Utensílios).");
        return;
      }

      const mustQty = needsPackQty(form.unit);
      const qty = parsePositiveInt(form.packQty);
      if (mustQty && qty == null) {
        alert("Preencha uma quantidade válida (inteiro > 0) para essa embalagem.");
        return;
      }
      const packQtyToSave: number | null = mustQty ? qty : null;

      const colorsToSave = form.colors
        .map((c) => ({ name: normalizeColorName(c.name), hex: c.hex }))
        .filter((c) => c.name && isHexColor(c.hex));

      const unitPriceCents = parseBRLToCents(form.price);
      const packPriceCents = parseBRLToCents(form.packPrice);

      if (!mustQty) {
        if (unitPriceCents == null) {
          setPriceTouched(true);
          alert("Preencha um valor válido (ex: 59,90).");
          return;
        }
      } else {
        if (packPriceCents == null) {
          setPackPriceTouched(true);
          alert("Preencha o valor total válido (ex: 599,00).");
          return;
        }
      }

      // 1) transforma a lista atual (remote+local) em remote, subindo só aqui
      const finalUrls: string[] = [];
      const finalPaths: string[] = [];

      for (const item of imgItems) {
        if (item.kind === "remote") {
          finalUrls.push(item.url);
          finalPaths.push(item.path);
          continue;
        }

        const { url, path } = await uploadProductImage(item.file, "products");
        finalUrls.push(url);
        finalPaths.push(path);

        URL.revokeObjectURL(item.url);
      }

      // 2) grava Firestore
      if (form.id) {
        await updateProduct(form.id, {
          name,
          brand,
          category,
          active: form.active,
          segment: segmentToSave,
          sku: form.sku.trim(),
          description: form.description.trim(),
          unit: form.unit,
          packQty: packQtyToSave,
          colors: colorsToSave,
          priceCents: unitPriceCents ?? null,
          packPriceCents: mustQty ? (packPriceCents ?? null) : null,
          imageUrls: finalUrls,
          imagePaths: finalPaths,
        });

        for (const p of deletedRemotePaths) {
          try {
            await deleteImageByPath(p);
          } catch (e) {
            void e;
          }
        }
      } else {
        await createProduct({
          name,
          brand,
          category,
          active: form.active,
          segment: segmentToSave,
          sku: form.sku.trim(),
          description: form.description.trim(),
          unit: form.unit,
          packQty: packQtyToSave,
          colors: colorsToSave,

          priceCents: unitPriceCents ?? null,
          packPriceCents: mustQty ? (packPriceCents ?? null) : null,

          imageUrls: finalUrls,
          imagePaths: finalPaths,
        });
      }

      await reload();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function delProduct(p: Product) {
    if (!confirm("Excluir este produto?")) return;
    const paths = Array.isArray((p as Product & { imagePaths?: string[] }).imagePaths)
      ? ((p as Product & { imagePaths?: string[] }).imagePaths as string[])
      : [];
    for (const path of paths) {
      if (!path) continue;
      try {
        await deleteImageByPath(path);
      } catch (e) {
        void e;
      }
    }
    await removeProduct(p.id);
    await reload();
  }

  async function bulkDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (
      !confirm(
        `Excluir ${ids.length} produto(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      )
    )
      return;

    setBulkDeleting(true);
    try {
      const map = new Map(items.map((p) => [p.id, p]));
      for (const id of ids) {
        const p = map.get(id);
        if (!p) continue;

        const paths = Array.isArray((p as Product & { imagePaths?: string[] }).imagePaths)
          ? ((p as Product & { imagePaths?: string[] }).imagePaths as string[])
          : [];

        for (const path of paths) {
          if (!path) continue;
          try {
            await deleteImageByPath(path);
          } catch (e) {
            void e;
          }
        }

        await removeProduct(id);
      }

      clearSelection();
      await reload();
    } finally {
      setBulkDeleting(false);
    }
  }

  const mustQty = needsPackQty(form.unit);
  const qtyOk = !mustQty || parsePositiveInt(form.packQty) != null;
  const unitPriceOk = parseBRLToCents(form.price) != null;
  const showUnitPriceError = priceTouched && !unitPriceOk;
  const packPriceOk = parseBRLToCents(form.packPrice) != null;
  const showPackPriceError = packPriceTouched && mustQty && !packPriceOk;
  const segmentChosen = form.segment === "iluminacao" || form.segment === "utensilios";
  const categoryEnabled = segmentChosen && catsForSegment.length > 0;

  const selectedCount = selectedIds.size;
  const visibleSelectedCount = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    let c = 0;
    for (const p of filtered) if (selectedIds.has(p.id)) c++;
    return c;
  }, [filtered, selectedIds]);

  // ✅ header checkbox "selecionar tudo visível"
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someVisibleSelected =
    filtered.some((p) => selectedIds.has(p.id)) && !allVisibleSelected;

  const headerCheckRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!headerCheckRef.current) return;
    headerCheckRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  return (
    <div className="space-y-4">
      {/* ===================== TOPO ===================== */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, categoria, marca, código ou cor..."
          className="w-full sm:w-96 rounded-lg border px-3 py-2 text-sm"
        />

        <button
          onClick={() => openNew()}
          disabled={!canCreate}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          title={!canCreate ? "Crie uma categoria primeiro" : ""}
        >
          Novo produto
        </button>
      </div>

      {!canCreate && (
        <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
          Para cadastrar produto, primeiro crie uma categoria na aba{" "}
          <b>Categorias</b>.
        </div>
      )}

      {/* ===================== LISTA ===================== */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* ✅ checkbox master */}
            <input
              ref={headerCheckRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() => {
                if (allVisibleSelected) clearSelection();
                else selectAllVisible(filtered);
              }}
              className="h-4 w-4"
              aria-label="Selecionar todos visíveis"
              disabled={loading || filtered.length === 0}
              title="Selecionar todos visíveis"
            />
            <div>Produtos</div>
          </div>

          {/* ✅ removeu "Desmarcar" (deixei só Limpar) */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="text-xs text-zinc-600">
              Selecionados: <b>{selectedCount}</b>
              {q.trim() ? (
                <span className="text-zinc-500">
                  {" "}
                  (nesta busca: {visibleSelectedCount})
                </span>
              ) : null}
            </div>

            <button
              onClick={clearSelection}
              disabled={selectedCount === 0}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Limpar seleção"
            >
              Limpar
            </button>

            <button
              onClick={bulkDeleteSelected}
              disabled={selectedCount === 0 || bulkDeleting}
              className="rounded-lg border px-3 py-2 text-sm text-red-600 disabled:opacity-50"
              title="Excluir selecionados"
            >
              {bulkDeleting ? "Excluindo..." : "Excluir selecionados"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-zinc-600">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">Nenhum produto.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((p) => {
              const packInfo = formatPack(p.unit, p.packQty);
              const cents = p.priceCents;
              const packTotalCents =
                (p as Product & { packPriceCents?: number | null }).packPriceCents ?? null;

              const isPack = needsPackQty(p.unit as UnitOption);
              const firstImage = p.imageUrls?.[0] || "";
              const brand = String((p as Product & { brand?: string }).brand ?? "").trim();

              const checked = isSelected(p.id);

              return (
                <div
                  key={p.id}
                  // ✅ clique na linha seleciona/deseleciona (sem afetar botões/inputs)
                  onClick={() => toggleSelected(p.id)}
                  className={`px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between cursor-pointer ${
                    checked ? "bg-zinc-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* ✅ checkbox (para acessibilidade) */}
                    <label
                      className="pt-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelected(p.id)}
                        className="h-4 w-4"
                        aria-label={`Selecionar ${p.name}`}
                      />
                    </label>

                    <div
                      className="h-12 w-12 rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-xs text-zinc-500">sem foto</div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium">{p.name}</div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={categoryBadgeClass()}>{p.category || "—"}</span>

                        {brand ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10">
                            Marca: {brand}
                          </span>
                        ) : null}

                        {p.sku ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10">
                            Cod: {p.sku}
                          </span>
                        ) : null}

                        {packInfo ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10">
                            {packInfo}
                          </span>
                        ) : null}

                        {isPack && packTotalCents != null ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10">
                            Total {p.unit}: {formatCentsToBRLCurrency(packTotalCents)}
                          </span>
                        ) : null}

                        {cents != null ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10">
                            {formatCentsToBRLCurrency(cents)}
                          </span>
                        ) : null}

                        {p.active ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-600/10">
                            Inativo
                          </span>
                        )}
                      </div>

                      {p.colors?.length ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {p.colors.map((c) => (
                            <span
                              key={c.name}
                              className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium bg-white ring-1 ring-zinc-200"
                              title={c.name}
                            >
                              <span
                                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                                style={{ backgroundColor: c.hex }}
                              />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {p.description ? (
                        <div className="mt-2 text-xs text-zinc-600 whitespace-pre-wrap">
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* ✅ botões não “clicam” a linha */}
                  <div
                    className="flex flex-wrap gap-2 justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => delProduct(p)}
                      className="rounded-lg border px-3 py-2 text-sm text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== MODAL ===================== */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="h-full w-full bg-white flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b">
              <div className="text-lg font-semibold">
                {form.id ? "Editar produto" : "Novo produto"}
              </div>
            </div>
            <div className="flex-1 min-h-0 px-4 py-4 sm:px-6 overflow-y-auto">
              <div className="min-h-0 grid gap-6 grid-cols-1 lg:grid-cols-[620px_1fr] lg:items-stretch">
                {/* ===================== MODAL: IMAGENS ===================== */}
                <div className="min-h-0 flex flex-col lg:h-full lg:overflow-hidden">
                  <div className="text-sm font-medium">IMAGENS</div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className={`
                      mt-2 w-full rounded-xl border bg-zinc-50 overflow-hidden
                      flex items-center justify-center disabled:opacity-70
                      h-[30vh] sm:h-[36vh] lg:h-[min(42vh,520px)]
                      min-h-[200px] sm:min-h-[240px]
                    `}
                    title="Clique para selecionar imagens"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="preview"
                        className="h-full w-full object-contain"
                        onError={() => setPreview("")}
                      />
                    ) : (
                      <div className="text-sm text-zinc-500">
                        Clique aqui para selecionar imagens
                      </div>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />

                  {imgItems.length > 0 && (
                    <div className="mt-3 min-h-0 flex flex-col">
                      <div className="text-xs text-zinc-600 mb-2">
                        {imgItems.length} imagem(ns). A primeira é a{" "}
                        <b>principal</b>. Arraste para reordenar.
                      </div>

                      <div className="overflow-visible lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
                          {imgItems.map((item, idx) => {
                            const url = item.url;
                            return (
                              <div
                                key={`${url}-${idx}`}
                                className={`rounded-lg border overflow-hidden bg-white ${
                                  dragOverIdx === idx ? "ring-2 ring-black" : ""
                                }`}
                                draggable={!saving}
                                onDragStart={() => onDragStartThumb(idx)}
                                onDragEnd={onDragEndThumb}
                                onDragOver={(e) => onDragOverThumb(e, idx)}
                                onDrop={(e) => onDropThumb(e, idx)}
                                title="Arraste para reordenar"
                              >
                                <button
                                  type="button"
                                  onClick={() => setPreview(url)}
                                  className="block w-full aspect-square bg-zinc-50 flex items-center justify-center"
                                  title="Ver no preview"
                                >
                                  <img
                                    src={url}
                                    alt={`img-${idx + 1}`}
                                    className="h-full w-full object-contain"
                                    draggable={false}
                                  />
                                </button>

                                <div className="p-1 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    className={`text-[11px] rounded px-1.5 py-0.5 border ${
                                      idx === 0
                                        ? "bg-black text-white border-black"
                                        : "bg-white"
                                    }`}
                                    onClick={() => setMainImageByIndex(idx)}
                                    disabled={saving}
                                    title="Definir como principal"
                                  >
                                    Principal
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeImageAt(idx)}
                                    disabled={saving}
                                    className="text-[11px] rounded px-1.5 py-0.5 border text-red-600 disabled:opacity-40"
                                    title="Remover (só efetiva ao salvar)"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ===================== MODAL: CAMPOS ===================== */}
                <div className="min-h-0 flex flex-col lg:h-full">
                  <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                    <div>
                      <label className="block text-sm font-medium">Nome</label>
                      <input
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={form.name}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, name: e.target.value }))
                        }
                        placeholder="Ex: Spot Quadrado de Embutir..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Marca</label>
                      <input
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={form.brand}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, brand: e.target.value }))
                        }
                        placeholder="Ex: Tramontina, Philips..."
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium">
                          Segmento
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                          value={form.segment}
                          onChange={(e) => {
                            const seg = e.target.value as FormState["segment"];
                            setForm((s) => ({
                              ...s,
                              segment: seg,
                              category: "",
                            }));
                          }}
                        >
                          <option value="">— selecione —</option>
                          <option value="iluminacao">Iluminação</option>
                          <option value="utensilios">
                            Utensílios Domésticos
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium">
                          Categoria
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500"
                          value={form.category}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, category: e.target.value }))
                          }
                          disabled={!categoryEnabled}
                          title={
                            !segmentChosen
                              ? "Selecione o segmento primeiro"
                              : catsForSegment.length === 0
                                ? "Não há categorias cadastradas neste segmento"
                                : ""
                          }
                        >
                          {!segmentChosen ? (
                            <option value="">Selecione o segmento</option>
                          ) : catsForSegment.length === 0 ? (
                            <option value="">
                              Nenhuma categoria neste segmento
                            </option>
                          ) : (
                            catsForSegment.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium">
                          Embalagem
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                          value={form.unit}
                          onChange={(e) => {
                            const unit = e.target.value as UnitOption;
                            setForm((s) => ({
                              ...s,
                              unit,
                              packQty: needsPackQty(unit) ? s.packQty : "",
                              packPrice: needsPackQty(unit) ? s.packPrice : "",
                            }));
                            setPackPriceTouched(false);
                          }}
                        >
                          <option value="Unidade">Unidade</option>
                          <option value="Kit">Kit</option>
                          <option value="Meia Caixa">Meia Caixa</option>
                          <option value="Caixa Fechada">Caixa Fechada</option>
                          <option value="">—</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">
                          Valor (R$){" "}
                          {mustQty ? (
                            <span className="text-xs font-normal text-zinc-500">
                              (unidade - opcional)
                            </span>
                          ) : null}
                        </label>
                        <input
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                            !mustQty && showUnitPriceError
                              ? "border-red-500"
                              : ""
                          }`}
                          value={form.price}
                          onChange={(e) => {
                            setPriceTouched(true);
                            const d = digitsOnly(e.target.value);
                            const formatted = formatBRLInputFromDigits(d);
                            setForm((s) => ({ ...s, price: formatted }));
                          }}
                          onBlur={() => setPriceTouched(true)}
                          placeholder="Ex: 59,90"
                          inputMode="numeric"
                        />
                        {!mustQty && showUnitPriceError && (
                          <div className="mt-1 text-xs text-red-600">
                            Informe um valor válido (ex: 59,90).
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium">
                          Código/Referência (SKU)
                        </label>
                        <input
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                          value={form.sku}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, sku: e.target.value }))
                          }
                          placeholder="Ex: 4500"
                        />
                      </div>
                    </div>

                    {mustQty && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium">
                            {packQtyLabel(form.unit)}
                          </label>
                          <input
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                              qtyOk ? "" : "border-red-500"
                            }`}
                            value={form.packQty}
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                packQty: digitsOnly(e.target.value),
                              }))
                            }
                            placeholder="Ex: 10"
                            inputMode="numeric"
                          />
                          {!qtyOk && (
                            <div className="mt-1 text-xs text-red-600">
                              Informe um número inteiro maior que 0.
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium">
                            {packPriceLabel(form.unit)}
                          </label>
                          <input
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                              showPackPriceError ? "border-red-500" : ""
                            }`}
                            value={form.packPrice}
                            onChange={(e) => {
                              setPackPriceTouched(true);
                              const d = digitsOnly(e.target.value);
                              const formatted = formatBRLInputFromDigits(d);
                              setForm((s) => ({ ...s, packPrice: formatted }));
                            }}
                            onBlur={() => setPackPriceTouched(true)}
                            placeholder="Ex: 599,00"
                            inputMode="numeric"
                          />
                          {showPackPriceError && (
                            <div className="mt-1 text-xs text-red-600">
                              Informe um valor total válido (ex: 599,00).
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CORES */}
                    <div>
                      <label className="block text-sm font-medium">
                        Cores do produto
                      </label>

                      <div className="mt-1 flex flex-col sm:flex-row gap-2">
                        <input
                          ref={colorNameRef}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          placeholder="Ex: Branco, Preto Fosco, Dourado..."
                        />

                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newColorHex}
                            onChange={(e) => setNewColorHex(e.target.value)}
                            className="h-10 w-14 rounded-lg border bg-white p-1"
                            aria-label="Escolher cor"
                          />

                          <button
                            type="button"
                            onClick={upsertColor}
                            disabled={!normalizeColorName(newColorName)}
                            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                          >
                            {editingColorIndex == null ? "Adicionar" : "Salvar"}
                          </button>

                          {editingColorIndex != null && (
                            <button
                              type="button"
                              onClick={cancelEditColor}
                              className="rounded-lg border px-3 py-2 text-sm"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>

                      {form.colors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {form.colors.map((c, idx) => (
                            <span
                              key={`${c.name}-${idx}`}
                              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs bg-white ring-1 ring-zinc-200"
                            >
                              <span
                                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                                style={{ backgroundColor: c.hex }}
                                title={c.hex}
                              />
                              {c.name}

                              <button
                                type="button"
                                onClick={() => startEditColor(idx)}
                                className="ml-1 rounded-full px-2 py-0.5 text-xs border"
                                title="Editar cor"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => removeColorByIndex(idx)}
                                className="ml-1 rounded-full px-2 py-0.5 text-xs border"
                                title="Remover cor"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium">
                        Descrição
                      </label>
                      <textarea
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm min-h-[120px] lg:min-h-[140px]"
                        value={form.description}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Ex: Não acompanha lâmpadas..."
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, active: e.target.checked }))
                        }
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="border-t pt-3 mt-3 flex flex-col sm:flex-row justify-end gap-2 lg:mt-3">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border px-4 py-2 text-sm"
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={save}
                      disabled={
                        saving ||
                        !form.name.trim() ||
                        !form.segment ||
                        !form.category.trim() ||
                        !qtyOk ||
                        (!mustQty && !unitPriceOk) ||
                        (mustQty && !packPriceOk)
                      }
                      className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}