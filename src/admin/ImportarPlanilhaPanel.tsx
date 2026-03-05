import React, { useEffect, useMemo, useRef, useState } from "react";
import type { HomeSegment, ProductInput } from "../lib/produtos";
import { createProduct, listProducts } from "../lib/produtos";
import * as XLSX from "xlsx";

import { listCategories, type Category } from "../lib/categorias";
import { uploadProductImage } from "../lib/storageUpload";

type Props = {
  defaultSegment?: HomeSegment | null;
};

type RowMap = Record<string, unknown>;

type ParsedItem = {
  key: string; // sku__idx
  input: ProductInput;
  _meta: { sku: string; idx: number };
};

type ProductColor = { name: string; hex: string };

type RowEdits = Partial<
  Pick<
    ProductInput,
    | "name"
    | "brand"
    | "category"
    | "segment"
    | "sku"
    | "description"
    | "unit"
    | "packQty"
    | "priceCents"
    | "packPriceCents"
    | "imageUrls"
    | "imagePaths"
    | "colors"
    | "active"
  >
>;

function toCents(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const norm = s.replace(/\./g, "").replace(",", ".");
    const n = Number(norm);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return null;
}

function centsToBRL(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function centsToInput(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function inputToCents(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const norm = v.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function inferSegmentFromCategory(cat: string): HomeSegment | null {
  const c = cat.toLowerCase();
  if (!c) return null;
  if (c.includes("ilum")) return "iluminacao";
  return "utensilios";
}

function errorToMessage(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function moveInArray<T>(arr: T[], from: number, to: number) {
  const next = [...arr];
  if (from < 0 || from >= next.length) return next;
  if (to < 0 || to >= next.length) return next;
  if (from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function normalizeColorName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

/* ===================== CORES (IGUAL AO CADASTRO) ===================== */
function RowColorsEditor({
  busy,
  isExcluded,
  colors,
  onChange,
}: {
  rowKey: string;
  busy: boolean;
  isExcluded: boolean;
  colors: ProductColor[];
  onChange: (next: ProductColor[]) => void;
}) {
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const colorNameRef = useRef<HTMLInputElement | null>(null);

  function focusColorName(selectAll = false) {
    setTimeout(() => {
      const el = colorNameRef.current;
      if (!el) return;
      el.focus();
      if (selectAll) el.select();
    }, 0);
  }

  function resetColorDrafts() {
    setNewColorName("");
    setNewColorHex("#000000");
    setEditingColorIndex(null);
  }

  function startEditColor(idx: number) {
    const c = colors[idx];
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

    const next = [...colors];

    if (editingColorIndex == null) {
      const exists = next.some(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (exists) return;
      onChange([...next, { name, hex }]);
      resetColorDrafts();
      focusColorName();
      return;
    }

    if (editingColorIndex < 0 || editingColorIndex >= next.length) return;

    const duplicateOther = next.some((c, i) => {
      if (i === editingColorIndex) return false;
      return c.name.trim().toLowerCase() === name.toLowerCase();
    });
    if (duplicateOther) return;

    next[editingColorIndex] = { name, hex };
    onChange(next);
    resetColorDrafts();
    focusColorName();
  }

  function removeColorByIndex(idx: number) {
    const next = [...colors];
    if (idx < 0 || idx >= next.length) return;
    next.splice(idx, 1);
    onChange(next);

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

  return (
    <div className="sm:col-span-2">
      <div className="text-[11px] font-semibold text-zinc-600 mb-1">
        Cores do produto
      </div>

      <div className="mt-1 flex flex-col sm:flex-row gap-2">
        <input
          ref={colorNameRef}
          className="w-full rounded-md border px-3 py-2"
          value={newColorName}
          disabled={busy || isExcluded}
          onChange={(e) => setNewColorName(e.target.value)}
          placeholder="Ex: Branco, Preto Fosco, Dourado..."
        />

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColorHex}
            disabled={busy || isExcluded}
            onChange={(e) => setNewColorHex(e.target.value)}
            className="h-10 w-14 rounded-lg border bg-white p-1"
            aria-label="Escolher cor"
          />

          <button
            type="button"
            onClick={upsertColor}
            disabled={busy || isExcluded || !normalizeColorName(newColorName)}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            {editingColorIndex == null ? "Adicionar" : "Salvar"}
          </button>

          {editingColorIndex != null && (
            <button
              type="button"
              onClick={cancelEditColor}
              disabled={busy || isExcluded}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {colors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {colors.map((c, idx) => (
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
                disabled={busy || isExcluded}
                className="ml-1 rounded-full px-2 py-0.5 text-xs border disabled:opacity-50"
                title="Editar cor"
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() => removeColorByIndex(idx)}
                disabled={busy || isExcluded}
                className="ml-1 rounded-full px-2 py-0.5 text-xs border disabled:opacity-50"
                title="Remover cor"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== IMAGENS (IGUAL AO CADASTRO) ===================== */
function RowImagesEditor({
  rowKey,
  busy,
  isExcluded,
  imageUrls,
  onUpload,
  onSetPreview,
  preview,
  onSetMain,
  onRemoveAt,
  onReorder,
}: {
  rowKey: string;
  busy: boolean;
  isExcluded: boolean;
  imageUrls: string[];
  onUpload: (files: FileList) => void;
  preview: string;
  onSetPreview: (url: string) => void;
  onSetMain: (idx: number) => void;
  onRemoveAt: (idx: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const disabled = busy || isExcluded;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
    onReorder(from, idx);
  }

  return (
    <div className="min-h-0 flex flex-col lg:h-full lg:overflow-hidden">
      <div className="text-sm font-medium">IMAGENS</div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
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
            onError={() => onSetPreview("")}
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
        disabled={disabled}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onUpload(files);
          e.currentTarget.value = "";
        }}
      />

      {imageUrls.length > 0 && (
        <div className="mt-3 min-h-0 flex flex-col">
          <div className="text-xs text-zinc-600 mb-2">
            {imageUrls.length} imagem(ns). A primeira é a <b>principal</b>. Arraste
            para reordenar.
          </div>

          <div className="overflow-visible lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
              {imageUrls.map((url, idx) => (
                <div
                  key={`${rowKey}-${url}-${idx}`}
                  className={`rounded-lg border overflow-hidden bg-white ${
                    dragOverIdx === idx ? "ring-2 ring-black" : ""
                  }`}
                  draggable={!disabled}
                  onDragStart={() => onDragStartThumb(idx)}
                  onDragEnd={onDragEndThumb}
                  onDragOver={(e) => onDragOverThumb(e, idx)}
                  onDrop={(e) => onDropThumb(e, idx)}
                  title="Arraste para reordenar"
                >
                  <button
                    type="button"
                    onClick={() => onSetPreview(url)}
                    className="block w-full aspect-square bg-zinc-50 flex items-center justify-center"
                    title="Ver no preview"
                    disabled={disabled}
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
                        idx === 0 ? "bg-black text-white border-black" : "bg-white"
                      }`}
                      onClick={() => onSetMain(idx)}
                      disabled={disabled}
                      title="Definir como principal"
                    >
                      Principal
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveAt(idx)}
                      disabled={disabled}
                      className="text-[11px] rounded px-1.5 py-0.5 border text-red-600 disabled:opacity-40"
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
    </div>
  );
}

export default function ImportarPlanilhaPanel({ defaultSegment = null }: Props) {
  const [rows, setRows] = useState<RowMap[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);

  const [pickedFileName, setPickedFileName] = useState<string>("");

  const [forceActive, setForceActive] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [edits, setEdits] = useState<Record<string, RowEdits>>({});

  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [imported, setImported] = useState<Record<string, boolean>>({});

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [dupDecision, setDupDecision] = useState<Record<string, boolean | undefined>>(
    {},
  );

  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [previewByKey, setPreviewByKey] = useState<Record<string, string>>({});

  function setRowPreview(key: string, url: string) {
    setPreviewByKey((prev) => ({ ...prev, [key]: url }));
  }
  function getRowPreview(key: string, fallbackFirst: string) {
    const v = previewByKey[key] ?? "";
    return v || fallbackFirst || "";
  }

  useEffect(() => {
    void (async () => {
      setCatsLoading(true);
      try {
        const cats = await listCategories();
        setCategories(cats);
      } catch {
        setCategories([]);
      } finally {
        setCatsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setProductsLoading(true);
      try {
        const products = await listProducts();

        const skuSet = new Set<string>();
        const brandSet = new Set<string>();

        for (const p of products) {
          const s = (p.sku ?? "").trim();
          if (s) skuSet.add(s);

          const b = (p.brand ?? "").trim();
          if (b) brandSet.add(b);
        }

        setExistingSkus(skuSet);
        setBrandOptions(Array.from(brandSet).sort((a, b) => a.localeCompare(b)));
      } catch {
        setExistingSkus(new Set());
        setBrandOptions([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  function patchRow(key: string, patch: RowEdits) {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...patch },
    }));
  }

  const parsed = useMemo<ParsedItem[]>(() => {
    const mapped: ParsedItem[] = [];

    rows.forEach((r, idx) => {
      const sku = cleanStr(r["Código (SKU)"]);
      const desc = cleanStr(r["Descrição"]);
      const descComp = cleanStr(r["Descrição complementar"]);

      const category = cleanStr(r["Categoria"]);
      const segmentAuto = inferSegmentFromCategory(category);
      const segment = defaultSegment ?? segmentAuto;

      const unidadeRaw = cleanStr(r["Unidade"]).toUpperCase();
      const unit =
        unidadeRaw === "UN"
          ? "Unidade"
          : unidadeRaw === "CX"
            ? "Caixa Fechada"
            : "";

      const packQtyNum = toNumber(r["Unidade por caixa"]);
      const packQty = packQtyNum && packQtyNum > 0 ? Math.trunc(packQtyNum) : null;

      const priceCents = toCents(r["Preço"]);
      const brand = cleanStr(r["Fornecedor"]);

      const name = desc;
      const description = descComp || "";

      if (!sku || !name) return;

      const base: ProductInput = {
        name,
        brand,
        category,
        active: forceActive,
        segment: segment ?? null,
        sku,
        description,
        unit,
        packQty,
        colors: [],
        priceCents,
        packPriceCents: null,
        imageUrls: [],
        imagePaths: [],
      };

      const key = `${sku}__${idx}`;
      const patch = edits[key];
      const merged: ProductInput = patch ? { ...base, ...patch } : base;

      if (!Array.isArray(merged.colors)) merged.colors = [];
      if (!Array.isArray(merged.imageUrls)) merged.imageUrls = [];
      if (!Array.isArray(merged.imagePaths)) merged.imagePaths = [];

      mapped.push({ key, _meta: { sku, idx }, input: merged });
    });

    return mapped;
  }, [rows, forceActive, defaultSegment, edits]);

  const visibleParsed = useMemo(() => {
    if (!parsed.length) return parsed;
    return parsed.filter((it) => !imported[it.key]);
  }, [parsed, imported]);

  useEffect(() => setPage(0), [rows.length]);

  async function onPickFile(file: File) {
    setLog([]);
    setRows([]);
    setEdits({});
    setExcluded({});
    setImported({});
    setSelected({});
    setDupDecision({});
    setProgress({ done: 0, total: 0 });
    setPage(0);
    setPreviewByKey({});

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheet];

    const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as RowMap[];
    setRows(json);
  }

  const totalPages = useMemo(() => {
    return visibleParsed.length === 0 ? 1 : Math.ceil(visibleParsed.length / pageSize);
  }, [visibleParsed.length]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageItems = visibleParsed.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

  function isDuplicateRow(it: ParsedItem): boolean {
    const sku = (it.input.sku ?? "").trim();
    if (!sku) return false;
    return existingSkus.has(sku) && dupDecision[it.key] !== true;
  }

  function acceptDuplicate(key: string) {
    setDupDecision((prev) => ({ ...prev, [key]: true }));
    setExcluded((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function ignoreDuplicate(key: string) {
    setDupDecision((prev) => ({ ...prev, [key]: false }));
    setExcluded((prev) => ({ ...prev, [key]: true }));
    setSelected((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleSelected(key: string, v: boolean) {
    setSelected((prev) => ({ ...prev, [key]: v }));
  }

  const selectedCountOnPage = useMemo(() => {
    let n = 0;
    for (const it of pageItems) if (selected[it.key]) n++;
    return n;
  }, [pageItems, selected]);

  function clearSelectedOnPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const it of pageItems) delete next[it.key];
      return next;
    });
  }

  function excludeSelectedOnPage() {
    if (selectedCountOnPage === 0) return;

    setExcluded((prev) => {
      const next = { ...prev };
      for (const it of pageItems) {
        if (selected[it.key]) next[it.key] = true;
      }
      return next;
    });

    clearSelectedOnPage();
  }

  function excludeAllOnPage() {
    setExcluded((prev) => {
      const next = { ...prev };
      for (const it of pageItems) next[it.key] = true;
      return next;
    });

    clearSelectedOnPage();
  }

  async function uploadImagesForRow(key: string, files: FileList) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    try {
      const uploaded: { url: string; path: string }[] = [];

      for (const f of list) {
        const { url, path } = await uploadProductImage(f, "products");
        uploaded.push({ url, path });
      }

      setEdits((prev) => {
        const cur = prev[key] ?? {};
        const urls = Array.isArray(cur.imageUrls) ? cur.imageUrls : [];
        const paths = Array.isArray(cur.imagePaths) ? cur.imagePaths : [];

        const nextUrls = [...urls];
        const nextPaths = [...paths];

        for (const u of uploaded) {
          if (!nextUrls.includes(u.url)) nextUrls.push(u.url);
          if (!nextPaths.includes(u.path)) nextPaths.push(u.path);
        }

        return {
          ...prev,
          [key]: { ...cur, imageUrls: nextUrls, imagePaths: nextPaths },
        };
      });

      setPreviewByKey((prev) => {
        const cur = prev[key] ?? "";
        if (cur) return prev;
        const first = uploaded[0]?.url ?? "";
        return first ? { ...prev, [key]: first } : prev;
      });
    } catch (e: unknown) {
      setLog((prev) => [...prev, `❌ Falha no upload: ${errorToMessage(e)}`]);
    }
  }

  function removeImageAt(key: string, idx: number, urls: string[], paths: string[]) {
    if (idx < 0 || idx >= urls.length) return;

    const removedUrl = urls[idx];
    const nextUrls = [...urls];
    const nextPaths = [...paths];
    nextUrls.splice(idx, 1);
    nextPaths.splice(idx, 1);

    patchRow(key, { imageUrls: nextUrls, imagePaths: nextPaths });

    setPreviewByKey((prev) => {
      const cur = prev[key] ?? "";
      if (cur !== removedUrl) return prev;
      const next = nextUrls[0] ?? "";
      return { ...prev, [key]: next };
    });
  }

  function setMainImageByIndex(
    key: string,
    idx: number,
    urls: string[],
    paths: string[],
  ) {
    if (idx < 0 || idx >= urls.length) return;

    const movedUrl = urls[idx];
    const nextUrls = moveInArray(urls, idx, 0);
    const nextPaths = moveInArray(paths, idx, 0);

    patchRow(key, { imageUrls: nextUrls, imagePaths: nextPaths });
    setRowPreview(key, movedUrl);
  }

  function moveImage(
    key: string,
    from: number,
    to: number,
    urls: string[],
    paths: string[],
  ) {
    const nextUrls = moveInArray(urls, from, to);
    const nextPaths = moveInArray(paths, from, to);
    patchRow(key, { imageUrls: nextUrls, imagePaths: nextPaths });
  }

  function canImportItem(it: ParsedItem) {
    if (excluded[it.key]) return false;
    if (imported[it.key]) return false;
    if (isDuplicateRow(it)) return false;
    return true;
  }

  async function importItems(items: ParsedItem[]) {
    const list = items.filter((it) => canImportItem(it));
    if (list.length === 0) return;

    setBusy(true);
    setProgress({ done: 0, total: list.length });
    setLog([]);

    const importedOkKeys: string[] = [];

    try {
      let done = 0;
      for (const it of list) {
        try {
          await createProduct(it.input);
          importedOkKeys.push(it.key);

          done++;
          setProgress({ done, total: list.length });
        } catch (e: unknown) {
          setLog((prev) => [
            ...prev,
            `❌ SKU ${it.input.sku} (${it.input.name}): ${errorToMessage(e)}`,
          ]);
        }
      }

      if (importedOkKeys.length > 0) {
        setImported((prev) => {
          const next = { ...prev };
          for (const k of importedOkKeys) next[k] = true;
          return next;
        });

        setExcluded((prev) => {
          const next = { ...prev };
          for (const k of importedOkKeys) delete next[k];
          return next;
        });

        setSelected((prev) => {
          const next = { ...prev };
          for (const k of importedOkKeys) delete next[k];
          return next;
        });

        setPreviewByKey((prev) => {
          const next = { ...prev };
          for (const k of importedOkKeys) delete next[k];
          return next;
        });
      }

      setLog((prev) => [
        ...prev,
        `✅ Importação finalizada. OK: ${importedOkKeys.length}/${list.length}`,
      ]);
    } finally {
      setBusy(false);
    }
  }

  const remainingExcluded = useMemo(() => {
    let n = 0;
    for (const it of visibleParsed) if (excluded[it.key]) n++;
    return n;
  }, [visibleParsed, excluded]);

  const remainingDuplicatesBlocked = useMemo(() => {
    let n = 0;
    for (const it of visibleParsed) if (isDuplicateRow(it)) n++;
    return n;
  }, [visibleParsed, existingSkus, dupDecision]);

  const importAllCount = useMemo(() => {
    let n = 0;
    for (const it of visibleParsed) if (canImportItem(it)) n++;
    return n;
  }, [visibleParsed, excluded, imported, existingSkus, dupDecision]);

  const importPageCount = useMemo(() => {
    let n = 0;
    for (const it of pageItems) if (canImportItem(it)) n++;
    return n;
  }, [pageItems, excluded, imported, existingSkus, dupDecision]);

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-4 sm:px-6">
      <div className="min-h-[calc(100vh-120px)] flex flex-col gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-lg font-black">Importar por planilha</div>
          <div className="text-sm text-neutral-600 mt-1">
            Aceita .xls/.xlsx. Vai ler a primeira aba da planilha.
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold cursor-pointer w-fit
                  ${busy ? "bg-blue-600/60" : "bg-blue-600 hover:bg-blue-700"}
                  text-white`}
              >
                <span>📄 Escolher arquivo</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPickedFileName(f?.name ?? "");
                    if (f) void onPickFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              <span className="text-sm text-neutral-600">
                {pickedFileName ? (
                  <>
                    Selecionado: <b className="text-neutral-900">{pickedFileName}</b>
                  </>
                ) : (
                  "Nenhum arquivo escolhido"
                )}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forceActive}
                disabled={busy}
                onChange={(e) => setForceActive(e.target.checked)}
              />
              <span>Importar como “Ativo” (padrão)</span>
            </label>

            {parsed.length > 0 ? (
              <div className="text-xs text-zinc-500">
                Total: <b>{parsed.length}</b> • Importados:{" "}
                <b>{Object.keys(imported).length}</b> • Restantes:{" "}
                <b>{visibleParsed.length}</b> • Excluídos (restantes):{" "}
                <b>{remainingExcluded}</b> • Duplicados (bloqueados):{" "}
                <b>{remainingDuplicatesBlocked}</b> • Vai importar:{" "}
                <b>{importAllCount}</b>
                {productsLoading ? " (carregando SKUs/marcas...)" : ""}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-50"
                disabled={busy || visibleParsed.length === 0 || importPageCount === 0}
                onClick={() => void importItems(pageItems)}
                type="button"
              >
                {busy ? "Importando..." : `Importar esta página (${importPageCount})`}
              </button>

              <button
                className="rounded-xl bg-black text-white px-4 py-2 font-bold disabled:opacity-50"
                disabled={busy || visibleParsed.length === 0 || importAllCount === 0}
                onClick={() => void importItems(visibleParsed)}
                type="button"
              >
                {busy ? "Importando..." : `Importar todos (${importAllCount})`}
              </button>

              <div className="text-sm text-neutral-700">
                Progresso: <b>{progress.done}</b>/<b>{progress.total}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-black">Prévia editável</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-sm bg-white disabled:opacity-50"
                disabled={busy || visibleParsed.length === 0 || safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Anterior
              </button>

              <div className="text-sm text-neutral-700">
                Página <b>{safePage + 1}</b> / <b>{totalPages}</b>
              </div>

              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-sm bg-white disabled:opacity-50"
                disabled={busy || visibleParsed.length === 0 || safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Próxima →
              </button>
            </div>
          </div>

          {visibleParsed.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-xs bg-white disabled:opacity-50"
                disabled={busy}
                onClick={excludeAllOnPage}
              >
                Excluir todos desta página
              </button>

              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-xs bg-white disabled:opacity-50"
                disabled={busy || selectedCountOnPage === 0}
                onClick={excludeSelectedOnPage}
              >
                Excluir selecionados ({selectedCountOnPage})
              </button>

              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-xs bg-white disabled:opacity-50"
                disabled={busy || selectedCountOnPage === 0}
                onClick={clearSelectedOnPage}
              >
                Limpar seleção
              </button>

              <div className="text-xs text-zinc-500">
                (Sel = só seleção • Excluído = não importa • Duplicado precisa “Aceitar”)
              </div>
            </div>
          ) : null}

          <div className="mt-3 overflow-auto flex-1 min-h-0 space-y-3">
            {pageItems.map((it) => {
              const isExcluded = !!excluded[it.key];
              const isSel = !!selected[it.key];
              const isDup = isDuplicateRow(it);

              const rowEdit = edits[it.key] ?? {};
              const urls = Array.isArray(rowEdit.imageUrls)
                ? rowEdit.imageUrls
                : Array.isArray(it.input.imageUrls)
                  ? it.input.imageUrls
                  : [];
              const paths = Array.isArray(rowEdit.imagePaths)
                ? rowEdit.imagePaths
                : Array.isArray(it.input.imagePaths)
                  ? it.input.imagePaths
                  : [];
              const colors = Array.isArray(rowEdit.colors)
                ? rowEdit.colors
                : Array.isArray(it.input.colors)
                  ? it.input.colors
                  : [];

              const preview = getRowPreview(it.key, urls[0] ?? "");
              const seg =
                (rowEdit.segment as HomeSegment | null | undefined) ??
                it.input.segment ??
                null;
              const segmentChosen = seg === "iluminacao" || seg === "utensilios";
              const catsForSegment = categories
                .filter((c) => c.segment === seg)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              const categoryEnabled = segmentChosen && catsForSegment.length > 0;

              return (
                <div
                  key={it.key}
                  className={`rounded-xl border p-3 ${isExcluded ? "opacity-60" : "bg-white"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isSel}
                        disabled={busy || isExcluded}
                        onChange={(e) => toggleSelected(it.key, e.target.checked)}
                      />
                      <span className="text-xs text-zinc-600">Selecionar</span>
                    </label>

                    {isExcluded ? (
                      <span className="text-xs rounded-full border px-2 py-0.5 bg-neutral-50">
                        Excluído
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                        Código/Referência (SKU)
                      </div>
                      <input
                        className="w-full rounded-md border px-3 py-2 font-semibold"
                        value={it.input.sku}
                        disabled={busy || isExcluded}
                        onChange={(e) => patchRow(it.key, { sku: e.target.value })}
                      />

                      {isDup ? (
                        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
                          <div className="font-semibold">⚠ SKU já existe no banco.</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 bg-white text-xs"
                              disabled={busy}
                              onClick={() => acceptDuplicate(it.key)}
                            >
                              Aceitar mesmo assim
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 bg-white text-xs"
                              disabled={busy}
                              onClick={() => ignoreDuplicate(it.key)}
                            >
                              Ignorar (excluir)
                            </button>
                          </div>
                        </div>
                      ) : dupDecision[it.key] === true ? (
                        <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                          ✓ Duplicado aceito
                        </div>
                      ) : null}
                    </div>

                    <div className="lg:col-span-2">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                        Nome
                      </div>
                      <input
                        className="w-full rounded-md border px-3 py-2"
                        value={it.input.name}
                        disabled={busy || isExcluded}
                        onChange={(e) => patchRow(it.key, { name: e.target.value })}
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                        Marca
                      </div>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={it.input.brand ?? ""}
                        disabled={busy || isExcluded || productsLoading}
                        onChange={(e) => patchRow(it.key, { brand: e.target.value })}
                      >
                        <option value="">(sem marca)</option>
                        {it.input.brand && !brandOptions.includes(it.input.brand) ? (
                          <option value={it.input.brand}>{it.input.brand}</option>
                        ) : null}
                        {brandOptions.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 min-h-0 grid gap-6 grid-cols-1 lg:grid-cols-[620px_1fr] lg:items-stretch">
                    <RowImagesEditor
                      rowKey={it.key}
                      busy={busy}
                      isExcluded={isExcluded}
                      imageUrls={urls}
                      preview={preview}
                      onSetPreview={(u) => setRowPreview(it.key, u)}
                      onUpload={(files) => void uploadImagesForRow(it.key, files)}
                      onSetMain={(idx) => setMainImageByIndex(it.key, idx, urls, paths)}
                      onRemoveAt={(idx) => removeImageAt(it.key, idx, urls, paths)}
                      onReorder={(from, to) => moveImage(it.key, from, to, urls, paths)}
                    />

                    <div className="min-h-0 flex flex-col lg:h-full">
                      <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Segmento
                            </div>
                            <select
                              className="w-full rounded-md border px-3 py-2 bg-white"
                              value={seg ?? ""}
                              disabled={busy || isExcluded || !!defaultSegment}
                              onChange={(e) => {
                                const nextSeg = (e.target.value || null) as HomeSegment | null;
                                patchRow(it.key, {
                                  segment: nextSeg,
                                  category: "",
                                });
                              }}
                            >
                              <option value="">— selecione —</option>
                              <option value="iluminacao">Iluminação</option>
                              <option value="utensilios">Utensílios Domésticos</option>
                            </select>
                          </div>

                          <div className="sm:col-span-1">
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Categoria
                            </div>
                            <select
                              className="w-full rounded-md border px-3 py-2 bg-white disabled:bg-zinc-50 disabled:text-zinc-500"
                              value={it.input.category ?? ""}
                              disabled={busy || isExcluded || catsLoading || !categoryEnabled}
                              onChange={(e) => patchRow(it.key, { category: e.target.value })}
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
                                <option value="">Nenhuma categoria neste segmento</option>
                              ) : (
                                catsForSegment.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          <RowColorsEditor
                            key={it.key}
                            rowKey={it.key}
                            busy={busy}
                            isExcluded={isExcluded}
                            colors={colors}
                            onChange={(next) => patchRow(it.key, { colors: next })}
                          />

                          <div>
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Ativo
                            </div>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!it.input.active}
                                disabled={busy || isExcluded}
                                onChange={(e) => patchRow(it.key, { active: e.target.checked })}
                              />
                              <span className="text-sm">Ativo</span>
                            </label>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Embalagem
                            </div>
                            <select
                              className="w-full rounded-md border px-3 py-2"
                              value={it.input.unit}
                              disabled={busy || isExcluded}
                              onChange={(e) =>
                                patchRow(it.key, {
                                  unit: e.target.value as ProductInput["unit"],
                                })
                              }
                            >
                              <option value="">(vazio)</option>
                              <option value="Unidade">Unidade</option>
                              <option value="Kit">Kit</option>
                              <option value="Meia Caixa">Meia Caixa</option>
                              <option value="Caixa Fechada">Caixa Fechada</option>
                            </select>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Quantidade Meia Caixa ou Caixa Inteira
                            </div>
                            <input
                              className="w-full rounded-md border px-3 py-2"
                              inputMode="numeric"
                              value={it.input.packQty ?? ""}
                              disabled={busy || isExcluded}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const n = v ? Number(v) : NaN;
                                patchRow(it.key, {
                                  packQty: Number.isFinite(n) ? Math.trunc(n) : null,
                                });
                              }}
                            />
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                              Valor (R$)
                            </div>
                            <input
                              className="w-full rounded-md border px-3 py-2"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={centsToInput(it.input.priceCents)}
                              disabled={busy || isExcluded}
                              onChange={(e) =>
                                patchRow(it.key, {
                                  priceCents: inputToCents(e.target.value),
                                })
                              }
                            />
                            <div className="mt-1 text-xs text-zinc-500">
                              {centsToBRL(it.input.priceCents)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                            Descrição
                          </div>
                          <textarea
                            className="w-full rounded-md border px-3 py-2 min-h-[120px]"
                            value={it.input.description ?? ""}
                            disabled={busy || isExcluded}
                            onChange={(e) =>
                              patchRow(it.key, { description: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleParsed.length === 0 ? (
              <div className="py-6 text-neutral-500">Nada restante para importar.</div>
            ) : null}
          </div>

          {log.length > 0 ? (
            <div className="mt-4 rounded-lg bg-neutral-50 border p-3 text-sm whitespace-pre-wrap">
              {log.join("\n")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}