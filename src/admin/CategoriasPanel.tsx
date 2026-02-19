import { useEffect, useMemo, useState } from "react";
import {
  createCategory,
  listCategories,
  removeCategory,
  renameCategory,
  setCategoryOrder,
  type Category,
} from "../lib/categories";
import { listProducts, removeProduct } from "../lib/products";
import type { Product } from "../lib/products";

type Props = {
  onEditProduct?: (id: string) => void;
  onNewProduct?: (categoryName: string) => void;
};
type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";
type ProductColor = { name: string; hex: string };
type ProductWithColors = Product & { colors?: ProductColor[] };

function categoryBadgeClass() {
  return "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-600/20";
}
function formatPack(unit: UnitOption, packQty: number | null) {
  if (!unit) return null;
  if (unit === "Unidade") return "Unidade";
  return packQty && packQty > 0 ? `${unit} • ${packQty} peças` : unit;
}

export default function CategoriasPanel({
  onEditProduct,
  onNewProduct,
}: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [openCatIds, setOpenCatIds] = useState<Set<string>>(() => new Set());

  async function reload() {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([listCategories(), listProducts()]);
      setCats(c);
      setProducts(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const productsByCategoryName = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const key = (p.category || "").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [products]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createCategory(name, cats.length);
      setNewName("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: Category) {
    setEditId(c.id);
    setEditName(c.name);
  }

  async function saveEdit() {
    if (!editId) return;
    setSavingEdit(true);
    try {
      await renameCategory(editId, editName);
      setEditId(null);
      setEditName("");
      await reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function delCategory(c: Category) {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    await removeCategory(c.id);
    await reload();
  }
  async function delProd(p: Product) {
    if (!confirm(`Excluir o produto "${p.name}"?`)) return;
    await removeProduct(p.id);
    await reload();
  }

  function toggleOpen(c: Category) {
    setOpenCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });
  }

  async function moveUp(index: number) {
    if (index <= 0) return;
    const a = cats[index - 1],
      b = cats[index];
    await Promise.all([
      setCategoryOrder(a.id, b.order),
      setCategoryOrder(b.id, a.order),
    ]);
    await reload();
  }

  async function moveDown(index: number) {
    if (index >= cats.length - 1) return;
    const a = cats[index],
      b = cats[index + 1];
    await Promise.all([
      setCategoryOrder(a.id, b.order),
      setCategoryOrder(b.id, a.order),
    ]);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">Cadastrar categoria</div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exemplo de Categoria: Arandela, Spot Duplo, Lustre..."
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            disabled={saving || !newName.trim()}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Categorias cadastradas (ordem da página principal)
        </div>

        {loading ? (
          <div className="p-4 text-sm text-zinc-600">Carregando...</div>
        ) : cats.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">
            Nenhuma categoria cadastrada ainda.
          </div>
        ) : (
          <div className="divide-y">
            {cats.map((c, idx) => {
              const list = productsByCategoryName.get(c.name) ?? [];
              const isOpen = openCatIds.has(c.id);

              return (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  {/* ESQUERDA */}
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <button
      type="button"
      onClick={() => toggleOpen(c)}
      className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:bg-zinc-50"
      title={isOpen ? "Fechar produtos" : "Abrir produtos"}
      aria-expanded={isOpen}
    >
      <svg
        className={`h-6 w-6 text-black transition-transform ${isOpen ? "rotate-90" : ""}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.24 4.24c.3.3.3.77 0 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    </button>

    <div className="min-w-0">
      <div className="font-medium">{c.name}</div>
      <div className="text-sm text-zinc-600">{list.length} produto(s)</div>
    </div>
  </div>

  {/* DIREITA */}
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex gap-1">
      <button
        onClick={() => moveUp(idx)}
        disabled={idx === 0}
        className="rounded-lg border px-2 py-2 text-sm disabled:opacity-40"
        title="Subir"
      >
        ↑
      </button>
      <button
        onClick={() => moveDown(idx)}
        disabled={idx === cats.length - 1}
        className="rounded-lg border px-2 py-2 text-sm disabled:opacity-40"
        title="Descer"
      >
        ↓
      </button>
    </div>

                      {editId === c.id ? (
                        <>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full sm:w-56 rounded-lg border px-3 py-2 text-sm"
                          />
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || !editName.trim()}
                            className="rounded-lg bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                          >
                            {savingEdit ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            onClick={() => {
                              setEditId(null);
                              setEditName("");
                            }}
                            className="rounded-lg border px-3 py-2 text-sm"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-lg border px-3 py-2 text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => delCategory(c)}
                            className="rounded-lg border px-3 py-2 text-sm text-red-600"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-xl border bg-white">
                      <div className="border-b px-4 py-3 flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Produtos</div>
                        <button
                          className="rounded-lg bg-black px-3 py-2 text-sm text-white"
                          onClick={() =>
                            onNewProduct
                              ? onNewProduct(c.name)
                              : alert("Abra a aba Produtos para cadastrar.")
                          }
                        >
                          Novo produto nesta categoria
                        </button>
                      </div>

                      {list.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-600">
                          Nenhum produto cadastrado nesta categoria ainda.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {list.map((pBase) => {
                            const p = pBase as ProductWithColors;
                            const packInfo = formatPack(
                              p.unit as UnitOption,
                              p.packQty ?? null,
                            );
                            const colors = Array.isArray(p.colors)
                              ? p.colors
                              : [];

                            return (
                              <div
                                key={p.id}
                                className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="h-12 w-12 rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center shrink-0">
                                    {p.imageUrl ? (
                                      <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="text-xs text-zinc-500">
                                        sem foto
                                      </div>
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

                                    {colors.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {colors.map((cc) => (
                                          <span
                                            key={`${p.id}-${cc.name}`}
                                            className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium bg-white ring-1 ring-zinc-200"
                                            title={cc.name}
                                          >
                                            <span
                                              className="h-3 w-3 rounded-full ring-1 ring-black/10"
                                              style={{
                                                backgroundColor: cc.hex,
                                              }}
                                            />
                                            {cc.name}
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
                                    onClick={() =>
                                      onEditProduct
                                        ? onEditProduct(p.id)
                                        : alert(
                                            "Abra a aba Produtos para editar.",
                                          )
                                    }
                                    className="rounded-lg border px-3 py-2 text-sm"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => delProd(p)}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
