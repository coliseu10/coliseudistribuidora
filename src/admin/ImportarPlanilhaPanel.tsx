import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_COLOR: ProductColor = { name: "Branco", hex: "#FFFFFF" };

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

function getSingleColor(input: ProductInput): ProductColor {
  const c = input.colors?.[0];
  if (c?.name && c?.hex) return { name: c.name, hex: c.hex };
  return DEFAULT_COLOR;
}

export default function ImportarPlanilhaPanel({ defaultSegment = null }: Props) {
  const [rows, setRows] = useState<RowMap[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);

  // ✅ nome do arquivo escolhido (só UI)
  const [pickedFileName, setPickedFileName] = useState<string>("");

  // ativo global (padrão)
  const [forceActive, setForceActive] = useState(true);

  // categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  // produtos existentes (sku + marcas)
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // edits
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});

  // excluir / importados
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [imported, setImported] = useState<Record<string, boolean>>({});

  // seleção (para excluir selecionados)
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // duplicados: decisão (true aceitar, false ignorar, undefined pendente)
  const [dupDecision, setDupDecision] = useState<Record<string, boolean | undefined>>(
    {}
  );

  // paginação
  const [page, setPage] = useState(0);
  const pageSize = 20;

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

      const category = cleanStr(r["Categoria"]); // pode ser ""

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

      // marca da planilha
      const brand = cleanStr(r["Fornecedor"]);

      const segmentAuto = inferSegmentFromCategory(category);
      const segment = defaultSegment ?? segmentAuto;

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
        colors: [DEFAULT_COLOR],
        priceCents,
        packPriceCents: null,
        imageUrls: [],
        imagePaths: [],
      };

      const key = `${sku}__${idx}`;
      const patch = edits[key];
      const merged: ProductInput = patch ? { ...base, ...patch } : base;

      if (!merged.colors || merged.colors.length === 0) merged.colors = [DEFAULT_COLOR];

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
    safePage * pageSize + pageSize
  );

  const knownCategoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) set.add(c.name);
    return set;
  }, [categories]);

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
      for (const f of list) {
        const { url, path } = await uploadProductImage(f, "products");

        setEdits((prev) => {
          const cur = prev[key] ?? {};
          const urls = cur.imageUrls ?? [];
          const paths = cur.imagePaths ?? [];

          const nextUrls = urls.includes(url) ? urls : [...urls, url];
          const nextPaths = paths.includes(path) ? paths : [...paths, path];

          return {
            ...prev,
            [key]: {
              ...cur,
              imageUrls: nextUrls,
              imagePaths: nextPaths,
            },
          };
        });
      }
    } catch (e: unknown) {
      setLog((prev) => [...prev, `❌ Falha no upload: ${errorToMessage(e)}`]);
    }
  }

  function removeUploadedImage(key: string, url: string, path?: string) {
    setEdits((prev) => {
      const cur = prev[key] ?? {};
      const urls = cur.imageUrls ?? [];
      const paths = cur.imagePaths ?? [];

      const nextUrls = urls.filter((x) => x !== url);
      const nextPaths = path ? paths.filter((p) => p !== path) : paths;

      return {
        ...prev,
        [key]: { ...cur, imageUrls: nextUrls, imagePaths: nextPaths },
      };
    });
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
        {/* ===================== TOP ===================== */}
        <div className="rounded-xl border bg-white p-4">
          <div className="text-lg font-black">Importar por planilha</div>
          <div className="text-sm text-neutral-600 mt-1">
            Aceita .xls/.xlsx. Vai ler a primeira aba da planilha.
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {/* ✅ Botão azul (sem mudar estrutura do painel) */}
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
                    // permite escolher o mesmo arquivo de novo
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              <span className="text-sm text-neutral-600">
                {pickedFileName ? (
                  <>
                    Selecionado:{" "}
                    <b className="text-neutral-900">{pickedFileName}</b>
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

        {/* ===================== LISTA (CARDS) ===================== */}
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

              const color = getSingleColor(it.input);

              return (
                <div
                  key={it.key}
                  className={`rounded-xl border p-3 ${isExcluded ? "opacity-60" : "bg-white"}`}
                >
                  {/* Header (SKU/Nome/Marca + seleção) */}
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
                    {/* SKU */}
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

                    {/* Nome */}
                    <div className="lg:col-span-2">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">Nome</div>
                      <input
                        className="w-full rounded-md border px-3 py-2"
                        value={it.input.name}
                        disabled={busy || isExcluded}
                        onChange={(e) => patchRow(it.key, { name: e.target.value })}
                      />
                    </div>

                    {/* Marca */}
                    <div className="lg:col-span-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">Marca</div>
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

                  {/* Body (Descrição + campos lado a lado) */}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {/* Descrição */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                        Descrição
                      </div>
                      <textarea
                        className="w-full rounded-md border px-3 py-2 min-h-[120px]"
                        value={it.input.description ?? ""}
                        disabled={busy || isExcluded}
                        onChange={(e) => patchRow(it.key, { description: e.target.value })}
                      />
                    </div>

                    {/* Campos */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Categoria */}
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                          Categoria
                        </div>
                        <select
                          className="w-full rounded-md border px-3 py-2"
                          value={it.input.category ?? ""}
                          disabled={busy || isExcluded || catsLoading}
                          onChange={(e) => patchRow(it.key, { category: e.target.value })}
                        >
                          <option value="">(sem categoria)</option>
                          {it.input.category && !knownCategoryNames.has(it.input.category) ? (
                            <option value={it.input.category}>{it.input.category}</option>
                          ) : null}
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {it.input.category && !knownCategoryNames.has(it.input.category) ? (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Categoria não existe ainda (vai importar com esse nome).
                          </div>
                        ) : null}
                      </div>

                      {/* Cores do produto (padrão chip + editar) */}
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                          Cores do produto
                        </div>

                        <input
                          className="w-full rounded-md border px-3 py-2"
                          value={color.name}
                          disabled={busy || isExcluded}
                          onChange={(e) =>
                            patchRow(it.key, {
                              colors: [{ ...color, name: e.target.value }],
                            })
                          }
                        />

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white">
                            <span
                              className="h-3 w-3 rounded-full border"
                              style={{ background: color.hex }}
                            />
                            <span className="text-xs">{color.name || "Cor"}</span>
                          </span>

                          <label className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white text-xs cursor-pointer">
                            Editar
                            <input
                              type="color"
                              className="hidden"
                              disabled={busy || isExcluded}
                              value={color.hex}
                              onChange={(e) =>
                                patchRow(it.key, {
                                  colors: [{ ...color, hex: e.target.value }],
                                })
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full border bg-white text-xs"
                            disabled={busy || isExcluded}
                            onClick={() => patchRow(it.key, { colors: [DEFAULT_COLOR] })}
                            title="Remover / Voltar pro Branco"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Ativo */}
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

                      {/* Unid */}
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                          Embalagem
                        </div>
                        <select
                          className="w-full rounded-md border px-3 py-2"
                          value={it.input.unit}
                          disabled={busy || isExcluded}
                          onChange={(e) =>
                            patchRow(it.key, { unit: e.target.value as ProductInput["unit"] })
                          }
                        >
                          <option value="">(vazio)</option>
                          <option value="Unidade">Unidade</option>
                          <option value="Kit">Kit</option>
                          <option value="Meia Caixa">Meia Caixa</option>
                          <option value="Caixa Fechada">Caixa Fechada</option>
                        </select>
                      </div>

                      {/* Pack */}
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

                      {/* Preço */}
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
                            patchRow(it.key, { priceCents: inputToCents(e.target.value) })
                          }
                        />
                        <div className="mt-1 text-xs text-zinc-500">
                          {centsToBRL(it.input.priceCents)}
                        </div>
                      </div>

                      {/* Imagens */}
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-zinc-600 mb-1">
                          Imagens
                        </div>
                        <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm bg-white cursor-pointer w-fit">
                          <span>📷 Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            multiple
                            disabled={busy || isExcluded}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                void uploadImagesForRow(it.key, files);
                              }
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>

                        <div className="mt-2 space-y-1">
                          {(it.input.imageUrls ?? []).map((u, i) => (
                            <div key={`${u}_${i}`} className="flex items-center gap-2">
                              <a
                                className="text-xs text-blue-600 underline break-all"
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {u}
                              </a>

                              <button
                                type="button"
                                className="text-xs rounded-md border px-2 py-0.5 bg-white"
                                disabled={busy || isExcluded}
                                onClick={() =>
                                  removeUploadedImage(
                                    it.key,
                                    u,
                                    (it.input.imagePaths ?? [])[i]
                                  )
                                }
                              >
                                Remover
                              </button>
                            </div>
                          ))}

                          {(it.input.imageUrls ?? []).length === 0 ? (
                            <div className="text-xs text-zinc-500">Sem imagens</div>
                          ) : null}
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