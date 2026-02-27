import { useEffect, useMemo, useRef, useState } from "react";
import { listCategories, type Category } from "../lib/categories";
import {
  createProduct,
  listProducts,
  removeProduct,
  updateProduct,
  type ProductColor,
} from "../lib/products";
import type { Product } from "../lib/products";
import { normalizeImageUrl } from "../lib/normalizeImageUrl";

export type ProductIntent =
  | { type: "edit"; id: string }
  | { type: "new"; category?: string };

type Props = {
  intent?: ProductIntent | null;
  clearIntent?: () => void;
};

type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";

type FormState = {
  id?: string;
  name: string;
  category: string;
  active: boolean;

  sku: string;
  description: string;
  unit: UnitOption;

  packQty: string;
  price: string;

  colors: ProductColor[];
  imageUrls: string[];
};

const emptyForm: FormState = {
  name: "",
  category: "",
  active: true,
  sku: "",
  description: "",
  unit: "Unidade",
  packQty: "",
  price: "",
  colors: [],
  imageUrls: [],
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

  /* ===================== STATE (modal/form) ===================== */
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ===================== STATE (imagens) ===================== */
  const [preview, setPreview] = useState<string>("");
  const [imageDraft, setImageDraft] = useState("");

  /* ===================== STATE (cores) ===================== */
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(
    null
  );

  /* ===================== STATE (validações) ===================== */
  const [priceTouched, setPriceTouched] = useState(false);

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

  /* ===================== INTENT ===================== */
  useEffect(() => {
    if (!intent) return;
    if (loading) return;

    if (intent.type === "new") {
      if (cats.length === 0) return;
      openNew(intent.category);
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

  /* ===================== FILTER ===================== */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((p) => {
      const inBase =
        (p.name || "").toLowerCase().includes(s) ||
        (p.category || "").toLowerCase().includes(s) ||
        (p.sku || "").toLowerCase().includes(s);

      const inColors =
        (p.colors || []).some((c) => (c.name || "").toLowerCase().includes(s));

      return inBase || inColors;
    });
  }, [items, q]);

  const canCreate = cats.length > 0;

  /* ===================== MODAL: open/close ===================== */
  function resetColorDrafts() {
    setNewColorName("");
    setNewColorHex("#000000");
    setEditingColorIndex(null);
  }

  function openNew(categoryOverride?: string) {
    const first = categoryOverride ?? cats[0]?.name ?? "";
    const next: FormState = {
      ...emptyForm,
      category: first,
      unit: "Unidade",
      packQty: "",
      price: "",
      colors: [],
      imageUrls: [],
      active: true,
    };

    setForm(next);
    setPreview("");
    setImageDraft("");
    resetColorDrafts();
    setPriceTouched(false);
    setOpen(true);
  }

  function openEdit(p: Product) {
    const rawUrls =
      p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];

    const imageUrls = uniq(
      rawUrls.map((u) => normalizeImageUrl(u)).filter(Boolean)
    );

    const next: FormState = {
      id: p.id,
      name: p.name,
      category: p.category,
      active: p.active,
      sku: p.sku,
      description: p.description,
      unit: p.unit,
      packQty: p.packQty != null ? String(p.packQty) : "",
      price: p.priceCents != null ? formatCentsToBRLInput(p.priceCents) : "",
      colors: Array.isArray(p.colors) ? p.colors : [],
      imageUrls,
    };

    setForm(next);
    setPreview(imageUrls[0] || "");
    setImageDraft("");
    resetColorDrafts();
    setPriceTouched(false);
    setOpen(true);
  }

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
          (c) => c.name.trim().toLowerCase() === name.toLowerCase()
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

  /* ===================== IMAGENS ===================== */
  function addImageUrl() {
    const normalized = normalizeImageUrl(imageDraft);
    if (!normalized) {
      alert("Cole uma URL válida de imagem.");
      return;
    }

    setForm((s) => {
      const next = uniq([...(s.imageUrls || []), normalized]);
      return { ...s, imageUrls: next };
    });

    setPreview(normalized);
    setImageDraft("");
  }

  function removeImageUrl(url: string) {
    setForm((s) => {
      const next = (s.imageUrls || []).filter((u) => u !== url);
      if (preview === url) setPreview(next[0] || "");
      return { ...s, imageUrls: next };
    });
  }

  function setMainImage(url: string) {
    setForm((s) => {
      const rest = (s.imageUrls || []).filter((u) => u !== url);
      const next = [url, ...rest];
      return { ...s, imageUrls: next };
    });
    setPreview(url);
  }

  // ✅ NOVO: reordenar imagens (pré)
  function moveImage(fromIndex: number, toIndex: number) {
    setForm((s) => {
      const arr = [...(s.imageUrls || [])];
      if (fromIndex < 0 || fromIndex >= arr.length) return s;
      if (toIndex < 0 || toIndex >= arr.length) return s;
      if (fromIndex === toIndex) return s;

      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);

      // mantém preview coerente (se a imagem atual existir, fica nela; senão, primeira)
      const nextPreview = preview && arr.includes(preview) ? preview : arr[0] || "";
      setPreview(nextPreview);

      return { ...s, imageUrls: arr };
    });
  }

  function clearImages() {
    setForm((s) => ({ ...s, imageUrls: [] }));
    setPreview("");
    setImageDraft("");
  }

  /* ===================== SAVE ===================== */
  async function save() {
    setSaving(true);
    try {
      const name = form.name.trim();
      const category = form.category.trim();
      if (!name || !category) return;

      const imageUrls = uniq(
        (form.imageUrls || [])
          .map((u) => normalizeImageUrl(u))
          .filter(Boolean)
      );

      const imageUrl = imageUrls[0] || "";

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

      const priceCents = parseBRLToCents(form.price);
      if (priceCents == null) {
        setPriceTouched(true);
        alert("Preencha um valor válido (ex: 59,90).");
        return;
      }

      if (form.id) {
        await updateProduct(form.id, {
          name,
          category,
          active: form.active,
          sku: form.sku.trim(),
          description: form.description.trim(),
          unit: form.unit,
          packQty: packQtyToSave,
          colors: colorsToSave,

          priceCents,
          imageUrls,

          imageUrl,

          imagePath: "",
        });

        setOpen(false);
        await reload();
        return;
      }

      await createProduct({
        name,
        category,
        active: form.active,
        sku: form.sku.trim(),
        description: form.description.trim(),
        unit: form.unit,
        packQty: packQtyToSave,
        colors: colorsToSave,

        priceCents,
        imageUrls,

        imageUrl,

        imagePath: "",
      });

      await reload();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Excluir este produto?")) return;
    await removeProduct(id);
    await reload();
  }

  const mustQty = needsPackQty(form.unit);
  const qtyOk = !mustQty || parsePositiveInt(form.packQty) != null;

  const priceOk = parseBRLToCents(form.price) != null;
  const showPriceError = priceTouched && !priceOk;

  return (
    <div className="space-y-4">
      {/* ===================== TOPO ===================== */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, categoria, código ou cor..."
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
        <div className="border-b px-4 py-3 text-sm font-medium">Produtos</div>

        {loading ? (
          <div className="p-4 text-sm text-zinc-600">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">Nenhum produto.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((p) => {
              const packInfo = formatPack(p.unit, p.packQty);

              const cents = p.priceCents;
              const firstImage = p.imageUrls?.[0] || p.imageUrl;

              return (
                <div
                  key={p.id}
                  className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center shrink-0">
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
                        <span className={categoryBadgeClass()}>
                          {p.category || "—"}
                        </span>

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

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => del(p.id)}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          {/* ✅ Painel maior: mais largo (usa bem a tela) */}
          <div className="w-full max-w-[1400px] max-h-[95vh] overflow-y-auto rounded-2xl bg-white border p-6">
            <div className="text-lg font-semibold">
              {form.id ? "Editar produto" : "Novo produto"}
            </div>

            {/* ✅ Coluna de imagens mais larga */}
            <div className="mt-4 grid gap-6 lg:grid-cols-[620px_1fr]">
              {/* ===================== MODAL: IMAGENS ===================== */}
              <div>
                <div className="text-sm font-medium">
                  Imagens (Cloudinary ou Google Imagens)
                </div>

                <div className="mt-2 h-[220px] sm:h-[240px] lg:h-[260px] rounded-xl border bg-zinc-50 overflow-hidden flex items-center justify-center">
                  {preview ? (
                    <img
                      src={preview}
                      alt="preview"
                      className="h-full w-full object-contain"
                      onError={() => setPreview("")}
                    />
                  ) : (
                    <div className="text-sm text-zinc-500">
                      Adicione uma ou mais URLs abaixo
                    </div>
                  )}
                </div>

                <label className="mt-3 block text-sm font-medium">
                  URL da imagem (você pode adicionar várias)
                </label>

                <div className="mt-1 flex gap-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={imageDraft}
                    onChange={(e) => setImageDraft(e.target.value)}
                    placeholder="Cole o link do Google Imagens ou Cloudinary"
                  />
                  <button
                    type="button"
                    onClick={addImageUrl}
                    disabled={!imageDraft.trim()}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    title="Adicionar imagem"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={clearImages}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Limpar todas
                  </button>
                </div>

                {form.imageUrls.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-600 mb-2">
                      {form.imageUrls.length} imagem(ns). A primeira é a{" "}
                      <b>principal</b>.
                    </div>

                    <div className="mt-2 max-h-[260px] overflow-y-auto pr-1">
                      {/* ✅ thumbs maiores em mobile (2 colunas), depois 3/4 */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                        {form.imageUrls.map((url, idx) => (
                          <div
                            key={url}
                            className="rounded-lg border overflow-hidden bg-white"
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
                                onError={() => {
                                  const bad = url;
                                  setTimeout(() => removeImageUrl(bad), 0);
                                }}
                              />
                            </button>

                            {/* ✅ NOVO: setas pra reordenar */}
                            <div className="p-1 flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, idx - 1)}
                                  disabled={idx === 0}
                                  className="text-[11px] rounded px-1.5 py-0.5 border disabled:opacity-40"
                                  title="Mover para esquerda"
                                >
                                  ←
                                </button>

                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, idx + 1)}
                                  disabled={idx === form.imageUrls.length - 1}
                                  className="text-[11px] rounded px-1.5 py-0.5 border disabled:opacity-40"
                                  title="Mover para direita"
                                >
                                  →
                                </button>

                                <button
                                  type="button"
                                  className={`text-[11px] rounded px-1.5 py-0.5 border ${
                                    idx === 0
                                      ? "bg-black text-white border-black"
                                      : "bg-white"
                                  }`}
                                  onClick={() => setMainImage(url)}
                                  title="Definir como principal"
                                >
                                  {idx === 0 ? "Principal" : "Principal"}
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeImageUrl(url)}
                                className="text-[11px] rounded px-1.5 py-0.5 border text-red-600"
                                title="Remover"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-2 text-xs text-zinc-500">
                  Dica: Copie endereço de imagem e cole.
                </div>
              </div>

              {/* ===================== MODAL: CAMPOS ===================== */}
              <div className="space-y-4">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Categoria</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                      value={form.category}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, category: e.target.value }))
                      }
                    >
                      {cats.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Embalagem</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                      value={form.unit}
                      onChange={(e) => {
                        const unit = e.target.value as UnitOption;
                        setForm((s) => ({
                          ...s,
                          unit,
                          packQty: needsPackQty(unit) ? s.packQty : "",
                        }));
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

                <div>
                  <label className="block text-sm font-medium">Valor (R$)</label>
                  <input
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                      showPriceError ? "border-red-500" : ""
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
                  {showPriceError && (
                    <div className="mt-1 text-xs text-red-600">
                      Informe um valor válido (ex: 59,90).
                    </div>
                  )}
                </div>

                {mustQty && (
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
                )}

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

                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm min-h-[96px]"
                    value={form.description}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, description: e.target.value }))
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
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
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
                  !form.category.trim() ||
                  !qtyOk ||
                  !priceOk
                }
                className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}