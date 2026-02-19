import { useEffect, useMemo, useState } from "react";
import { listProducts } from "../lib/products";
import type { Product } from "../lib/products";

type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";
type ProductColor = { name: string; hex: string };

// Ajuste aqui conforme o seu model real (sem any)
type CatalogProduct = Product & {
  active: boolean;
  category: string;
  sku?: string | null;
  unit?: UnitOption | null;
  packQty?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  colors?: ProductColor[] | null;

  // se existir no seu model, ótimo; se não, cai em "Consulte"
  price?: number | string | null;
};

function formatPack(unit?: UnitOption | null, packQty?: number | null) {
  const u = unit ?? "";
  if (!u) return "—";
  if (u === "Unidade") return "Unidade";
  return packQty && packQty > 0 ? `${u} • ${packQty} peças` : u;
}

function formatPrice(v?: number | string | null) {
  if (typeof v === "number") {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  return "Consulte";
}

const CONTACTS = {
  phones: [
    { label: "COMERCIAL", value: "(11) 9.1769-0585" },
    { label: "VENDEDOR MATHEUS", value: "(11) 9.4112-9757" },
    { label: "VENDEDOR VINICIUS", value: "(11) 9.5080-5053" },
  ],
  emails: [
    "coliseu.adm01@gmail.com",
    "distribuidoracoliseu@distribuidoracoliseu.com",
  ],
  site: "www.distribuidoracoliseu.com.br",
};

export default function Home() {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [lightbox, setLightbox] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = (await listProducts()) as CatalogProduct[];
        setItems(data.filter((p) => p.active));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const cat = (p.category ?? "").toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      return name.includes(s) || cat.includes(s) || sku.includes(s);
    });
  }, [items, q]);

  const groups = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of filtered) {
      const cat = (p.category ?? "").trim() || "Sem categoria";
      const prev = map.get(cat) ?? [];
      prev.push(p);
      map.set(cat, prev);
    }

    const arr = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR"),
    );

    for (const [, list] of arr) {
      list.sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"),
      );
    }
    return arr;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* TOPO estilo PDF */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-center leading-tight">
            <div className="text-lg font-extrabold tracking-wide">
              CATÁLOGO DE
            </div>
            <div className="text-4xl font-black">Produtos</div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="h-2 w-full rounded-full bg-blue-900" />
            <div className="h-2 w-full rounded-full bg-orange-500" />
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {/* CONTATOS */}
            <div>
              <div className="text-xl font-black text-orange-600">
                CONTATOS:
              </div>

              <div className="mt-3 space-y-2">
                {CONTACTS.phones.map((p) => (
                  <div
                    key={p.label}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-semibold">{p.value}</span>
                    <span className="rounded-full border border-orange-400 px-2 py-0.5 text-xs font-bold text-orange-600">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm text-zinc-700">
                {CONTACTS.emails.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </div>

              <div className="mt-3 text-sm font-extrabold text-orange-600">
                {CONTACTS.site}
              </div>
            </div>

            {/* ENTREGA + BUSCA */}
            <div className="text-center md:text-right">
              <div className="text-base font-black text-blue-900">
                ENTREGA PARA TODO TERRITÓRIO
              </div>
              <div className="text-base font-black text-blue-900">NACIONAL</div>

              <div className="mt-4 text-2xl font-black text-cyan-500">
                ENTREGA EXPRESSA
              </div>
              <div className="text-sm font-semibold text-emerald-600">
                Consulte as condições com seu vendedor
              </div>
              <div className="text-xs font-semibold text-emerald-600">
                ( SP - Capital )
              </div>

              <div className="mt-6 flex justify-center md:justify-end">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome, categoria ou código..."
                  className="w-full md:w-96 rounded-lg border px-3 py-2 text-sm outline-none focus:ring"
                />
              </div>
            </div>
          </div>
        </div>

        {/* LISTAGEM */}
        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-zinc-600">Carregando...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-zinc-600">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(([cat, list]) => (
                <section key={cat} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-black" />
                    <h2 className="text-lg sm:text-xl font-black tracking-wide text-orange-600 uppercase">
                      {cat}
                    </h2>
                    <span className="h-2 w-2 rounded-full bg-black" />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[860px] table-fixed border border-zinc-900 text-sm">
                      {/* Colunas padronizadas */}
                      <colgroup>
                        <col style={{ width: "48%" }} />
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "20%" }} />
                        <col style={{ width: "14%" }} />
                      </colgroup>

                      <thead>
                        <tr>
                          <th className="border border-zinc-900 px-3 py-2 text-center font-black">
                            FOTO
                          </th>
                          <th className="border border-zinc-900 px-3 py-2 text-center font-black">
                            COR
                          </th>
                          <th className="border border-zinc-900 px-3 py-2 text-center font-black">
                            QTD / CX
                          </th>
                          <th className="border border-zinc-900 px-3 py-2 text-center font-black">
                            PREÇO
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {list.map((p) => {
                          const colors = Array.isArray(p.colors) ? p.colors : [];

                          return (
                            <tr key={p.id} className="align-top">
                              {/* FOTO + NOME + COD + DESCRIÇÃO */}
                              <td className="border border-zinc-900 px-3 py-3">
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0">
                                    {p.imageUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLightbox({
                                            url: p.imageUrl!,
                                            alt: p.name,
                                          })
                                        }
                                        className="h-16 w-16 rounded bg-zinc-100 overflow-hidden border hover:opacity-90"
                                        title="Ver imagem"
                                      >
                                        <img
                                          src={p.imageUrl}
                                          alt={p.name}
                                          className="h-full w-full object-cover"
                                        />
                                      </button>
                                    ) : (
                                      <div className="h-16 w-16 rounded bg-zinc-100 border flex items-center justify-center text-xs text-zinc-500">
                                        sem foto
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="font-semibold leading-snug">
                                      {p.name}
                                    </div>

                                    {p.sku ? (
                                      <div className="text-xs text-zinc-600">
                                        Cód: {p.sku}
                                      </div>
                                    ) : null}

                                    {p.description ? (
                                      <div
                                        className="mt-1 text-xs text-zinc-600"
                                        style={{
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {p.description}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>

                              {/* COR */}
                              <td className="border border-zinc-900 px-3 py-3">
                                {colors.length ? (
                                  <div className="space-y-2">
                                    {colors.map((c) => (
                                      <div
                                        key={`${p.id}-${c.name}`}
                                        className="flex items-center gap-2"
                                      >
                                        <span
                                          className="h-3 w-3 rounded-full ring-1 ring-black/20"
                                          style={{ backgroundColor: c.hex }}
                                          aria-hidden="true"
                                        />
                                        <span className="font-semibold">
                                          {c.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-zinc-500">—</span>
                                )}
                              </td>

                              {/* QTD/CX */}
                              <td className="border border-zinc-900 px-3 py-3 text-center">
                                <div className="font-semibold">
                                  {formatPack(p.unit ?? "", p.packQty ?? null)}
                                </div>
                              </td>

                              {/* PREÇO */}
                              <td className="border border-zinc-900 px-3 py-3 text-center">
                                <span className="font-semibold">
                                  {formatPrice(p.price ?? null)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">{lightbox.alt}</div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="p-4">
              <img
                src={lightbox.url}
                alt={lightbox.alt}
                className="w-full max-h-[70vh] object-contain rounded-lg bg-zinc-50"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
