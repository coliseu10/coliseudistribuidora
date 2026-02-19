import { useEffect, useMemo, useState } from "react";
import { listProducts } from "../lib/products";
import type { Product } from "../lib/products";

type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";

function formatPack(
  unit: UnitOption | null | undefined,
  packQty: number | null | undefined,
) {
  const u = (unit ?? "") as UnitOption;
  if (!u) return "";
  if (u === "Unidade") return "Unidade";
  return packQty && packQty > 0 ? `${u} • ${packQty} peças` : u;
}

function formatPriceCents(priceCents: number | null | undefined) {
  if (typeof priceCents === "number" && Number.isFinite(priceCents)) {
    return (priceCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return "";
}

function getProductImages(p: Product): string[] {
  const urls = Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : [];
  if (urls.length > 0) return urls;
  if (p.imageUrl) return [p.imageUrl];
  return [];
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

type LightboxState = {
  urls: string[];
  index: number;
  alt: string;
};

export default function Home() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listProducts();
        setItems(data.filter((p) => p.active));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => items, [items]);

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
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

  function openLightbox(p: Product) {
    const urls = getProductImages(p);
    if (!urls.length) return;

    setLightbox({
      urls,
      index: 0,
      alt: p.name || "Imagem do produto",
    });
  }

  function closeLightbox() {
    setLightbox(null);
  }

  function nextImage() {
    setLightbox((s) => {
      if (!s) return s;
      const next = Math.min(s.index + 1, s.urls.length - 1);
      return { ...s, index: next };
    });
  }

  function prevImage() {
    setLightbox((s) => {
      if (!s) return s;
      const prev = Math.max(s.index - 1, 0);
      return { ...s, index: prev };
    });
  }

  // ✅ Ajuste rápido do tamanho do thumb aqui:
  const THUMB_SIZE = "h-24 w-24"; // era 16x16. Pode trocar pra "h-28 w-28" se quiser maior ainda.

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* TOPO + BANNER (sem “caixa”) */}
        <div className="bg-white">
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

              <div className="mt-4 space-y-1 text-sm">
                {CONTACTS.emails.map((e) => (
                  <div key={e} className="font-bold text-zinc-900">
                    {e}
                  </div>
                ))}
              </div>

              <div className="mt-3 text-sm font-extrabold text-orange-600">
                {CONTACTS.site}
              </div>
            </div>

            {/* ENTREGA + LOGO */}
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
                <img
                  src="/logo.jpg"
                  alt="Distribuidora Coliseu"
                  className="h-24 w-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* BANNER */}
          <div
            className="mt-6 h-[480px] w-full rounded-xl bg-cover bg-center"
            style={{ backgroundImage: "url(/coliseu.png)" }}
            aria-label="Banner Distribuidora Coliseu"
          />
        </div>

        {/* LISTAGEM (sem caixas, sem espaçamento feio) */}
        <div className="mt-8">
          {loading ? (
            <div className="text-sm text-zinc-600">Carregando...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-zinc-600">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(([cat, list]) => (
                <section key={cat} className="bg-white">
                  {/* título da categoria (sem “borda/bolinha/divisória”) */}
                  <h2 className="text-lg sm:text-xl font-black tracking-wide text-orange-600 uppercase text-center">
                    {cat}
                  </h2>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[860px] table-fixed border border-zinc-900 text-sm">
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
                          const colors = Array.isArray(p.colors)
                            ? p.colors
                            : [];
                          const urls = getProductImages(p);
                          const firstImage = urls[0] ?? "";

                          return (
                            <tr key={p.id} className="align-top">
                              <td className="border border-zinc-900 px-3 py-3">
                                <div className="flex items-start gap-4">
                                  <div className="shrink-0">
                                    {firstImage ? (
                                      <button
                                        type="button"
                                        onClick={() => openLightbox(p)}
                                        className={`${THUMB_SIZE} rounded bg-white overflow-hidden border hover:opacity-90`}
                                        title="Abrir imagens"
                                      >
                                        <img
                                          src={firstImage}
                                          alt={p.name}
                                          className="h-full w-full object-contain"
                                        />
                                      </button>
                                    ) : (
                                      <div
                                        className={`${THUMB_SIZE} rounded bg-white border`}
                                      />
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="font-semibold leading-snug">
                                      {p.name}
                                    </div>

                                    {p.sku && (
                                      <div className="text-xs text-zinc-600">
                                        Cód: {p.sku}
                                      </div>
                                    )}

                                    {p.description && (
                                      <div className="mt-1 text-xs text-zinc-600 line-clamp-3">
                                        {p.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="border border-zinc-900 px-3 py-3">
                                {colors.length ? (
                                  colors.map((c) => (
                                    <div
                                      key={`${p.id}-${c.name}`}
                                      className="flex items-center gap-2"
                                    >
                                      <span
                                        className="h-3 w-3 rounded-full ring-1 ring-black/20"
                                        style={{ backgroundColor: c.hex }}
                                      />
                                      <span className="font-semibold">
                                        {c.name}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-zinc-500">
                                    &nbsp;
                                  </div>
                                )}
                              </td>

                              <td className="border border-zinc-900 px-3 py-3 text-center font-semibold">
                                {formatPack(p.unit ?? "", p.packQty ?? null)}
                              </td>

                              <td className="border border-zinc-900 px-3 py-3 text-center font-semibold">
                                {formatPriceCents(p.priceCents ?? null)}
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
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">{lightbox.alt}</div>

              <div className="flex gap-2">
                <button
                  onClick={prevImage}
                  disabled={lightbox.index === 0}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  ←
                </button>
                <button
                  onClick={nextImage}
                  disabled={lightbox.index >= lightbox.urls.length - 1}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  →
                </button>
                <button
                  onClick={closeLightbox}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <img
                src={lightbox.urls[lightbox.index]}
                alt={lightbox.alt}
                className="w-full max-h-[70vh] object-contain rounded-lg bg-white"
              />

              {lightbox.urls.length > 1 && (
                <div className="text-center text-xs text-zinc-600">
                  {lightbox.index + 1} / {lightbox.urls.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
