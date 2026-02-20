import { useEffect, useMemo, useRef, useState } from "react";
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

function slugify(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

  // ✅ NOVO: referência da faixa de categorias + botão flutuante
  const catBarRef = useRef<HTMLDivElement | null>(null);
  const [showCatFab, setShowCatFab] = useState(false);
  const [catFabOpen, setCatFabOpen] = useState(false);

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

  const categoryLinks = useMemo(
    () => groups.map(([cat]) => ({ cat, id: `cat-${slugify(cat)}` })),
    [groups],
  );

  // ✅ NOVO: mostra o botão flutuante quando a faixa sair de vista
  useEffect(() => {
    const el = catBarRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        const outOfView = !entry.isIntersecting;
        setShowCatFab(outOfView);
        if (!outOfView) setCatFabOpen(false);
      },
      { threshold: 0.15 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ✅ NOVO: fechar painel flutuante no ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCatFabOpen(false);
    }
    if (catFabOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catFabOpen]);

  // ✅ scroll suave apenas para os botões de categoria
  function scrollToCategory(id: string) {
    const el = document.getElementById(id);
    if (!el) return;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    // mantém a hash sem dar "pulo"
    history.replaceState(null, "", `#${id}`);

    if (reduceMotion) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    // Pega o "scroll-margin-top" real (ex: Tailwind scroll-mt-8 => 32px)
    const scrollMarginTop = parseFloat(
      (getComputedStyle(el).scrollMarginTop || "0").replace("px", ""),
    );

    const startY = window.scrollY || window.pageYOffset;
    const targetY =
      el.getBoundingClientRect().top +
      startY -
      (Number.isFinite(scrollMarginTop) ? scrollMarginTop : 0);

    const diff = targetY - startY;
    const distance = Math.abs(diff);

    // ✅ duração mais "gentil" (ajustável)
    const duration = Math.min(1800, Math.max(900, distance * 0.8)); // ms

    // ✅ easing bem suave (easeInOutCubic)
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let startTime: number | null = null;

    function step(now: number) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(t);

      window.scrollTo(0, startY + diff * eased);

      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // Fechar lightbox no ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!lightbox) return;
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

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

  return (
    // ✅ AJUSTE: trava qualquer overflow lateral gerado por w-screen/100vw
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="w-full px-4 py-6 lg:px-0">
        {/* TOPO */}
        <div className="bg-white">
          <div className="text-center leading-tight">
            <div className="text-4xl font-black tracking-wide">
              CATÁLOGO DE PRODUTOS
            </div>
          </div>

          {/* LINHAS INFINITAS */}
          <div className="mt-4 space-y-2">
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
              <div className="h-2 w-full rounded-full bg-blue-900" />
            </div>
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
              <div className="h-2 w-full rounded-full bg-orange-500" />
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:px-10 items-center">
            {/* CONTATOS */}
            <div className="text-center md:text-left">
              <div className="text-xl font-black text-orange-600">
                CONTATOS:
              </div>

              <div className="mt-3 space-y-2">
                {CONTACTS.phones.map((p) => (
                  <div
                    key={p.label}
                    className="flex flex-col items-center gap-1 md:flex-row md:items-center md:justify-start md:gap-2"
                  >
                    <span className="rounded-full border border-orange-400 px-2 py-0.5 text-xs font-bold text-orange-600">
                      {p.label}
                    </span>
                    <span className="font-semibold">{p.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm">
                {CONTACTS.emails.map((e) => (
                  <div key={e} className="font-bold text-zinc-900 break-all">
                    {e}
                  </div>
                ))}
              </div>

              <div className="mt-3 text-sm font-extrabold text-orange-600">
                {CONTACTS.site}
              </div>
            </div>

            {/* LOGO NO MEIO */}
            <div className="hidden lg:flex justify-center">
              <img
                src="/logo.jpg"
                alt="Distribuidora Coliseu"
                className="h-55 w-auto object-contain"
              />
            </div>

            {/* ENTREGA */}
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

              <div className="mt-6 flex justify-center md:justify-end lg:hidden">
                <img
                  src="/logo.jpg"
                  alt="Distribuidora Coliseu"
                  className="h-30 w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FAIXA INFINITA */}
        <div
          ref={catBarRef}
          className="relative left-1/2 right-1/2 -mx-[50vw] w-screen mt-8"
          style={{
            background:
              "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 40%, rgb(255,122,0) 100%)",
          }}
        >
          <div className="w-full px-4 py-6 lg:px-10 flex flex-col items-center gap-4">
            <div className="text-white font-black uppercase tracking-wide text-base sm:text-lg text-center">
              Encontre por categoria
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {categoryLinks.map(({ cat, id }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToCategory(id);
                  }}
                  title={`Ir para ${cat}`}
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/25"
                >
                  {cat}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* LISTAGEM */}
        <div className="mt-8 lg:px-10">
          {loading ? (
            <div className="text-sm text-zinc-600">Carregando...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-zinc-600">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map(([cat, list]) => {
                const sectionId = `cat-${slugify(cat)}`;

                return (
                  <section
                    key={cat}
                    id={sectionId}
                    className="bg-white scroll-mt-8"
                  >
                    <h2
                      className="relative left-1/2 right-1/2 -mx-[50vw] w-screen text-center py-3 text-lg sm:text-xl font-black uppercase tracking-wide text-white"
                      style={{
                        background:
                          "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 45%, rgb(255,122,0) 100%)",
                      }}
                    >
                      {cat}
                    </h2>

                    {/* GRID */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {list.map((p) => {
                        const colors = Array.isArray(p.colors) ? p.colors : [];
                        const urls = getProductImages(p);
                        const firstImage = urls[0] ?? "";
                        const pack = formatPack(p.unit ?? "", p.packQty ?? null);
                        const price = formatPriceCents(p.priceCents ?? null);

                        return (
                          <article
                            key={p.id}
                            className="rounded-2xl bg-white overflow-hidden border-0 shadow-sm"
                          >
                            {/* IMAGEM */}
                            <div className="relative">
                              {firstImage ? (
                                <button
                                  type="button"
                                  onClick={() => openLightbox(p)}
                                  className="block w-full bg-white"
                                  title="Abrir imagens"
                                >
                                  <div className="h-48 w-full bg-white flex items-center justify-center">
                                    <img
                                      src={firstImage}
                                      alt={p.name}
                                      className="h-full w-full object-contain"
                                      loading="lazy"
                                    />
                                  </div>
                                </button>
                              ) : (
                                <div className="h-48 w-full bg-white" />
                              )}
                            </div>

                            {/* CONTEÚDO */}
                            <div className="p-4">
                              <div className="min-w-0">
                                <div className="font-black leading-snug line-clamp-2">
                                  {p.name}
                                </div>

                                {p.sku ? (
                                  <div className="mt-1 text-xs text-zinc-600">
                                    Cód: {p.sku}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-zinc-600">
                                    &nbsp;
                                  </div>
                                )}

                                {p.description ? (
                                  <div className="mt-2 text-xs text-zinc-700 line-clamp-3">
                                    {p.description}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-zinc-700">
                                    &nbsp;
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 h-px w-full bg-zinc-200" />

                              {/* META */}
                              <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                                {/* COR */}
                                <div className="min-w-0">
                                  <div className="text-[11px] font-black text-zinc-700">
                                    COR
                                  </div>

                                  {colors.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {colors.slice(0, 6).map((c) => (
                                        <span
                                          key={`${p.id}-${c.name}`}
                                          className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold"
                                          title={c.name}
                                        >
                                          <span
                                            className="h-3 w-3 rounded-full ring-1 ring-black/20"
                                            style={{ backgroundColor: c.hex }}
                                          />
                                          <span className="truncate max-w-[140px]">
                                            {c.name}
                                          </span>
                                        </span>
                                      ))}

                                      {colors.length > 6 && (
                                        <span className="text-xs font-semibold text-zinc-600">
                                          +{colors.length - 6}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-xs text-zinc-500">
                                      &nbsp;
                                    </div>
                                  )}
                                </div>

                                {/* Quantidade + Preço */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                    <div className="font-semibold leading-tight line-clamp-2">
                                      {pack || <span>&nbsp;</span>}
                                    </div>
                                  </div>

                                  <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                    <div className="flex items-center justify-between">
                                      <div className="text-[11px] font-black text-zinc-700">
                                        Preço
                                      </div>
                                      <div className="text-base font-black text-zinc-900">
                                        {price || <span>&nbsp;</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* ✅ sem botão extra */}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ✅ NOVO: BOTÃO FLUTUANTE + LISTA DE CATEGORIAS */}
      {showCatFab && categoryLinks.length > 0 && (
        <>
          {/* (opcional) clique fora para fechar */}
          {catFabOpen && (
            <div
              className="fixed inset-0 z-30"
              onClick={() => setCatFabOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className="fixed bottom-4 right-4 z-40">
            {/* ✅ botão aparece SÓ quando o painel está fechado */}
            {!catFabOpen && (
              <button
                type="button"
                onClick={() => setCatFabOpen(true)}
                className="rounded-full px-4 py-3 text-sm font-black text-white shadow-lg border border-white/20"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 45%, rgb(255,122,0) 100%)",
                }}
                aria-expanded={false}
                aria-controls="cat-fab-panel"
                title="Categorias"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="text-lg leading-none">↕</span>
                  <span className="hidden sm:inline">Categorias</span>
                </span>
              </button>
            )}

            {/* ✅ painel aparece quando aberto (sem o botão em cima) */}
            {catFabOpen && (
              <div
                id="cat-fab-panel"
                className="w-[min(92vw,420px)] rounded-2xl border bg-white shadow-xl overflow-hidden"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="text-sm font-black text-zinc-900">
                    Encontre por categoria
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatFabOpen(false)}
                    className="rounded-lg border px-2 py-1 text-sm"
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 flex flex-wrap gap-2">
                  {categoryLinks.map(({ cat, id }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        scrollToCategory(id);
                        setCatFabOpen(false);
                      }}
                      className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-900 hover:bg-zinc-200"
                      title={`Ir para ${cat}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
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
                  title="Anterior (←)"
                >
                  ←
                </button>
                <button
                  onClick={nextImage}
                  disabled={lightbox.index >= lightbox.urls.length - 1}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  title="Próxima (→)"
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