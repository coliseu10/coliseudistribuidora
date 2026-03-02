import { useEffect, useMemo, useRef, useState } from "react";
import { listProducts, type HomeSegment } from "../lib/produtos";
import type { Product } from "../lib/produtos";

import { listCategories, type Category } from "../lib/categorias";

type UnitOption = "Unidade" | "Kit" | "Meia Caixa" | "Caixa Fechada" | "";

function formatPack(
  unit: UnitOption | null | undefined,
  packQty: number | null | undefined,
) {
  const u = (unit ?? "") as UnitOption;
  if (!u) return "";
  if (u === "Unidade") return "Unidade";
  return packQty && packQty > 0 ? `${u} • ${packQty}\u00A0UNIDADES` : u;
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

/** ✅ Agora só usa o formato atual (imageUrls). Remove legado p.imageUrl */
function getProductImages(p: Product): string[] {
  return Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : [];
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

function normCat(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const CONTACTS = {
  phones: [
    {
      label: "COMERCIAL",
      value: "(11) 9.1769-0585",
      phone: "11917690585",
      kind: "tel" as const,
    },
    {
      label: "VENDEDOR MATHEUS",
      value: "(11) 9.4112-9757",
      phone: "11941129757",
      kind: "whats" as const,
    },
    {
      label: "VENDEDOR VINICIUS",
      value: "(11) 9.5080-5053",
      phone: "11950805053",
      kind: "whats" as const,
    },
  ],
  emails: ["coliseu.adm01@gmail.com"],
  site: "www.distribuidoracoliseu.com.br",
};

type LightboxState = {
  urls: string[];
  index: number;
  alt: string;
  product: Product; // infos do card no lightbox
};

export default function Home() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const [segment, setSegment] = useState<HomeSegment | null>(null);

  const catBarRef = useRef<HTMLDivElement | null>(null);
  const [showCatFab, setShowCatFab] = useState(false);
  const [catFabOpen, setCatFabOpen] = useState(false);

  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listProducts();
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const cats = await listCategories();
      setAllCategories(cats);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!segment) return [];
    return items.filter((p) => p.segment === segment);
  }, [items, segment]);

  const groups = useMemo(() => {
    if (!segment) return [];

    const catsForSegment = allCategories
      .filter((c) => c.segment === segment)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const catIndex = new Map<string, { name: string; order: number }>();
    for (const c of catsForSegment) {
      catIndex.set(normCat(c.name), { name: c.name, order: c.order });
    }

    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const raw = (p.category ?? "").trim();
      if (!raw) continue;
      const key = normCat(raw);

      const meta = catIndex.get(key);
      if (!meta) continue;

      const catName = meta.name;
      const prev = map.get(catName) ?? [];
      prev.push(p);
      map.set(catName, prev);
    }

    const arr = catsForSegment
      .map((c) => [c.name, map.get(c.name) ?? []] as const)
      .filter(([, list]) => list.length > 0)
      .map(([name, list]) => [name, list] as [string, Product[]]);

    for (const [, list] of arr) {
      list.sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"),
      );
    }

    return arr;
  }, [filtered, segment, allCategories]);

  const categoryLinks = useMemo(
    () => groups.map(([cat]) => ({ cat, id: `cat-${slugify(cat)}` })),
    [groups],
  );

  useEffect(() => {
    const el = catBarRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        const outOfView = !entry.isIntersecting;

        // ✅ Só mostra o botão quando a barra já ficou "pra cima" da tela (você passou por ela)
        const isAboveViewport = entry.boundingClientRect.top < 0;

        const shouldShow = outOfView && isAboveViewport;
        setShowCatFab(shouldShow);

        if (!shouldShow) setCatFabOpen(false);
      },
      { threshold: 0.15 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [segment]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCatFabOpen(false);
    }
    if (catFabOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catFabOpen]);

  function scrollToCategory(id: string) {
    const el = document.getElementById(id);
    if (!el) return;

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;

    history.replaceState(null, "", `#${id}`);

    if (reduceMotion) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

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

    const duration = Math.min(4500, Math.max(1800, distance * 2.0));

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

  function openLightbox(p: Product) {
    const urls = getProductImages(p);
    if (!urls.length) return;

    setLightbox({
      urls,
      index: 0,
      alt: p.name || "Imagem do produto",
      product: p,
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
    <div className="bg-white overflow-x-hidden">
      <div className="w-full px-4 py-6 lg:px-0 pb-6">
        <div className="bg-white">
          <div className="text-center leading-tight">
            <div className="text-4xl font-black tracking-wide">
              CATÁLOGO DE PRODUTOS
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
              <div className="h-2 w-full rounded-full bg-blue-900" />
            </div>
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
              <div className="h-2 w-full rounded-full bg-orange-500" />
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:px-10 items-center">
            {/* contatos */}
            <div className="text-left">
              <div className="text-xl font-black text-orange-600">
                CONTATOS:
              </div>

              <div className="mt-3 space-y-2">
                {CONTACTS.phones.map((p) => {
                  const isWhats = p.kind === "whats";

                  const href =
                    p.kind === "tel"
                      ? `tel:+55${p.phone}`
                      : `https://wa.me/55${p.phone}?text=${encodeURIComponent(
                          "Olá! Vim pelo catálogo da Coliseu.",
                        )}`;

                  const title =
                    p.kind === "tel" ? "Ligar agora" : "Chamar no WhatsApp";

                  return (
                    <a
                      key={p.label}
                      href={href}
                      target={isWhats ? "_blank" : undefined}
                      rel={isWhats ? "noreferrer" : undefined}
                      title={title}
                      className="flex flex-row items-center justify-start gap-2 hover:opacity-90"
                    >
                      <span className="px-2 py-0.5 text-xs font-bold text-orange-600">
                        {p.label}
                      </span>

                      <span className="inline-flex items-center gap-2 font-semibold text-zinc-900">
                        {isWhats ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 text-emerald-600"
                            aria-hidden="true"
                          >
                            <path
                              fill="currentColor"
                              d="M12.04 2C6.54 2 2.1 6.45 2.1 11.95c0 1.93.5 3.73 1.44 5.3L2 22l4.9-1.48a9.86 9.86 0 0 0 5.14 1.43h.01c5.5 0 9.94-4.45 9.94-9.95C21.99 6.45 17.54 2 12.04 2Zm5.77 14.09c-.24.67-1.2 1.23-1.88 1.38-.46.1-1.05.18-3.43-.73-3.04-1.2-5-4.14-5.15-4.33-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.05-2.52.28-.3.6-.37.8-.37h.58c.18 0 .42-.07.66.5.24.57.8 1.98.87 2.12.07.14.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.32.4-.46.54-.15.15-.3.3-.13.6.18.3.78 1.28 1.67 2.07 1.15 1.02 2.11 1.33 2.41 1.48.3.15.48.13.66-.08.18-.2.76-.88.96-1.18.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.07.13.07.74-.17 1.41Z"
                            />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 text-blue-900"
                            aria-hidden="true"
                          >
                            <path
                              fill="currentColor"
                              d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.85 21 3 13.15 3 3a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.24 1.01l-2.2 2.2Z"
                            />
                          </svg>
                        )}

                        {p.value}
                      </span>
                    </a>
                  );
                })}
              </div>

              <div className="mt-4 space-y-1 text-sm">
                {CONTACTS.emails.map((e) => (
                  <a
                    key={e}
                    href={`mailto:${e}?subject=${encodeURIComponent(
                      "Contato - Catálogo Coliseu",
                    )}`}
                    className="block font-bold text-zinc-900 break-all hover:opacity-90"
                    title="Enviar e-mail"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-blue-900"
                        aria-hidden="true"
                      >
                        <path
                          fill="currentColor"
                          d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"
                        />
                      </svg>
                      {e}
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-3 text-sm font-extrabold">
                <a
                  href={`https://${CONTACTS.site}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:opacity-90"
                  title="Abrir site"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-blue-900 shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm7.93 9h-3.21a15.6 15.6 0 0 0-1.1-5.02A8.02 8.02 0 0 1 19.93 11ZM12 4c.78 0 1.95 1.55 2.62 5H9.38C10.05 5.55 11.22 4 12 4ZM4.07 13h3.21c.2 1.77.63 3.48 1.1 5.02A8.02 8.02 0 0 1 4.07 13Zm3.21-2H4.07a8.02 8.02 0 0 1 4.31-5.02A15.6 15.6 0 0 0 7.28 11ZM12 20c-.78 0-1.95-1.55-2.62-5h5.24C13.95 18.45 12.78 20 12 20Zm3.62-1.98c.47-1.54.9-3.25 1.1-5.02h3.21a8.02 8.02 0 0 1-4.31 5.02ZM9.2 13c-.07-.66-.12-1.33-.12-2s.05-1.34.12-2h5.6c.07.66.12 1.33.12 2s-.05 1.34-.12 2H9.2Z"
                      />
                    </svg>

                    <span className="text-zinc-900 font-extrabold whitespace-nowrap shrink-0">
                      Compre pelo site:
                    </span>

                    <span className="min-w-0 flex-1 text-orange-600 font-black truncate">
                      {CONTACTS.site}
                    </span>
                  </span>
                </a>
              </div>
            </div>

            {/* logo desktop */}
            <div className="hidden lg:flex justify-center">
              <img
                src="/logo.jpg"
                alt="Distribuidora Coliseu"
                className="h-55 w-auto object-contain"
              />
            </div>

            {/* entrega */}
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

              {/* logo mobile */}
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

        {/* escolha do segmento */}
        {!segment && (
          <div className="mt-8 lg:px-10">
            <div className="flex items-start md:items-center">
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setSegment("iluminacao")}
                  className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <img
                    src="/ilumicao.png"
                    alt="Iluminação"
                    className="w-full object-cover transition group-hover:scale-105 h-[210px] sm:h-[280px] lg:h-[360px] 2xl:h-[400px]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white/15 px-6 py-3 text-white font-black text-3xl uppercase tracking-wide">
                      Iluminação
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSegment("utensilios")}
                  className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <img
                    src="/utensilio.png"
                    alt="Utensílios Domésticos"
                    className="w-full object-cover transition group-hover:scale-105 h-[210px] sm:h-[280px] lg:h-[360px] 2xl:h-[400px]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white/15 px-6 py-3 text-white font-black text-3xl uppercase tracking-wide">
                      Utensílios Domésticos
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {segment && (
          <div className="mt-8 lg:px-10 flex items-center justify-between gap-3">
            <div className="text-sm font-black text-zinc-800">
              {segment === "iluminacao"
                ? "Exibindo: Iluminação"
                : "Exibindo: Utensílios Domésticos"}
            </div>

            <button
              type="button"
              onClick={() => setSegment(null)}
              className="rounded-lg border-2 px-3 py-2 text-sm bg-white text-sky-400 font-black tracking-wide border-sky-400 hover:border-sky-600 hover:text-sky-600"
              title="Trocar"
            >
              Trocar categoria
            </button>
          </div>
        )}

        {segment && (
          <>
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

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {list.map((p) => {
                            const urls = getProductImages(p);
                            const firstImage = urls[0] ?? "";
                            const brand = String(
                              (p as Product & { brand?: string }).brand ?? "",
                            ).trim();

                            return (
                              <article
                                key={p.id}
                                className={[
                                  "relative rounded-xl bg-white overflow-hidden border border-zinc-200 shadow-md transition hover:shadow-lg hover:-translate-y-0.5",
                                  p.active ? "" : "opacity-60 grayscale",
                                ].join(" ")}
                              >
                                {!p.active && (
                                  <div className="absolute top-3 left-3 z-10 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                                    Indisponível
                                  </div>
                                )}

                                <div className="relative">
                                  {firstImage ? (
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(p)}
                                      className="group block w-full bg-white cursor-zoom-in"
                                      title="Clique para ampliar"
                                    >
                                      <div className="h-48 w-full bg-white flex items-center justify-center">
                                        <img
                                          src={firstImage}
                                          alt={p.name}
                                          className="h-full w-full object-contain transition group-hover:opacity-90"
                                          loading="lazy"
                                        />
                                      </div>
                                    </button>
                                  ) : (
                                    <div className="h-48 w-full bg-white" />
                                  )}
                                </div>

                                <div className="p-4">
                                  <div className="min-w-0">
                                    <div className="font-black text-zinc-700 leading-snug line-clamp-2">
                                      {p.name}
                                    </div>

                                    {/* ✅ MARCA */}
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {brand ? (
                                        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-black text-zinc-700 ring-1 ring-zinc-700/10">
                                          <span className="text-[11px]">
                                            MARCA:
                                          </span>
                                          <span className="font-black tracking-wide">
                                            {brand}
                                          </span>
                                        </span>
                                      ) : null}

                                      {p.sku?.trim() ? (
  <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-900 ring-1 ring-blue-900/10">
    <span className="text-[11px]">CÓDIGO:</span>
    <span className="font-black tracking-wide">{p.sku}</span>
  </span>
) : null}

                                      {!brand && !p.sku?.trim() ? (
                                        <span className="text-xs text-zinc-600">
                                          &nbsp;
                                        </span>
                                      ) : null}
                                    </div>

                                    {p.description ? (
                                      <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 transition">
                                        <div className="text-[11px] font-black text-zinc-700">
                                          DESCRIÇÃO
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-900 leading-relaxed line-clamp-4">
                                          {p.description}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-2 text-xs text-zinc-700">
                                        &nbsp;
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                                    <div className="grid grid-cols-1 gap-2">
                                      <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                          <div className="text-[11px] font-black text-zinc-700 shrink-0">
                                            COR:
                                          </div>

                                          {Array.isArray(p.colors) &&
                                          p.colors.length ? (
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                              {p.colors.slice(0, 6).map((c) => (
                                                <span
                                                  key={`${p.id}-${c.name}`}
                                                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-zinc-200"
                                                  title={c.name}
                                                >
                                                  <span
                                                    className="h-3 w-3 rounded-full ring-1 ring-black/20 shrink-0"
                                                    style={{
                                                      backgroundColor: c.hex,
                                                    }}
                                                  />
                                                  <span className="whitespace-nowrap">
                                                    {c.name}
                                                  </span>
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-xs text-zinc-500">
                                              &nbsp;
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                          <div className="text-[11px] font-black text-zinc-700">
                                            EMBALAGEM
                                          </div>
                                          <div className="mt-1 font-semibold leading-tight line-clamp-2">
                                            {formatPack(
                                              p.unit ?? "",
                                              p.packQty ?? null,
                                            ) || <span>&nbsp;</span>}
                                          </div>
                                        </div>

                                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                          <div className="text-[11px] font-black text-zinc-700">
                                            PREÇO
                                          </div>
                                          <div className="mt-1 text-base font-black text-zinc-800">
                                            {formatPriceCents(
                                              p.priceCents ?? null,
                                            ) || <span>&nbsp;</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
          </>
        )}
      </div>

      {/* botao flutuante */}
      {segment && showCatFab && categoryLinks.length > 0 && (
        <>
          {catFabOpen && (
            <div
              className="fixed inset-0 z-30"
              onClick={() => setCatFabOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className="fixed right-4 z-40 bottom-20 sm:bottom-4">
            {!catFabOpen && (
              <button
                type="button"
                onClick={() => setCatFabOpen(true)}
                className="rounded-full px-4 py-3 text-sm font-black shadow-lg border-2 bg-white text-sky-600 border-sky-400 hover:border-sky-600 hover:text-sky-700"
                aria-expanded={false}
                aria-controls="cat-fab-panel"
                title="Categorias"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="text-2xl sm:text-lg leading-none">↕</span>
                  <span className="hidden sm:inline">Categorias</span>
                </span>
              </button>
            )}

            {catFabOpen && (
              <div
                id="cat-fab-panel"
                className="w-[min(92vw,420px)] rounded-2xl border-2 border-sky-400 bg-white shadow-xl overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-sky-200 px-4 py-3">
                  <div className="text-sm font-black text-sky-700">
                    Encontre por categoria
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatFabOpen(false)}
                    className="rounded-lg border-2 border-sky-400 bg-white px-2 py-1 text-sm font-black text-sky-600 hover:border-sky-600 hover:text-sky-700"
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
                      className="rounded-full bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
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

      {/* lightbox */}
      {lightbox && (
        <LightboxML
          lightbox={lightbox}
          setLightbox={setLightbox}
          closeLightbox={closeLightbox}
          nextImage={nextImage}
          prevImage={prevImage}
          formatPack={formatPack}
          formatPriceCents={formatPriceCents}
        />
      )}
    </div>
  );
}

/* ===========================
   ✅ LIGHTBOX
   - Mobile (<=1023): overlay transparente (glass) ✅
   - Desktop (>=1024): full screen branco ✅
=========================== */
function LightboxML(props: {
  lightbox: LightboxState;
  setLightbox: React.Dispatch<React.SetStateAction<LightboxState | null>>;
  closeLightbox: () => void;
  nextImage: () => void;
  prevImage: () => void;
  formatPack: (
    unit: UnitOption | null | undefined,
    packQty: number | null | undefined,
  ) => string;
  formatPriceCents: (priceCents: number | null | undefined) => string;
}) {
  const {
    lightbox,
    setLightbox,
    closeLightbox,
    nextImage,
    prevImage,
    formatPack,
    formatPriceCents,
  } = props;

  const [zoomOpen, setZoomOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const hasMany = lightbox.urls.length > 1;
  const imgUrl = lightbox.urls[lightbox.index];

  const brand = String(
    (lightbox.product as Product & { brand?: string }).brand ?? "",
  ).trim();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)"); // ✅ sm/md
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (zoomOpen) setZoomOpen(false);
        else closeLightbox();
      }
      if (!zoomOpen) {
        if (e.key === "ArrowRight") nextImage();
        if (e.key === "ArrowLeft") prevImage();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomOpen, closeLightbox, nextImage, prevImage]);

  useEffect(() => {
    const scrollY = window.scrollY;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;

      window.scrollTo(0, scrollY);
    };
  }, []);

  /* MOBILE */
  const MobilePage = (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* header */}
      <div
        className="sticky top-0 z-10 px-3 pb-3 pt-4 flex items-center justify-between gap-3 bg-black/40 backdrop-blur-md shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="min-w-0 pt-3 pl-3 pr-1">
          <div className="text-white font-black text-sm leading-tight line-clamp-2">
            {lightbox.alt}
          </div>
        </div>

        <button
          type="button"
          onClick={closeLightbox}
          className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-white font-black hover:bg-white/25"
          aria-label="Fechar"
          title="Fechar"
        >
          ✕
        </button>
      </div>

      <div
        className={[
          "flex-1 min-h-0 overflow-y-auto py-4",
          "overscroll-contain",
          "[-webkit-overflow-scrolling:touch]",
        ].join(" ")}
        style={{
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* imagem (painel branco) */}
        <div className="px-3">
          <div className="relative w-full rounded-xl border border-white/15 bg-white overflow-hidden shadow-xl">
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="w-full h-[44vh] min-h-[260px] flex items-center justify-center cursor-zoom-in"
              title="Clique para ampliar"
            >
              <img
                src={imgUrl}
                alt={lightbox.alt}
                className="max-h-full max-w-full object-contain"
                loading="eager"
                draggable={false}
              />
            </button>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  disabled={lightbox.index === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 shadow disabled:opacity-30"
                  title="Anterior"
                  aria-label="Anterior"
                >
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-sky-600">
                    <path
                      d="M15 5L8 12l7 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={nextImage}
                  disabled={lightbox.index >= lightbox.urls.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 shadow disabled:opacity-30"
                  title="Próxima"
                  aria-label="Próxima"
                >
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-sky-600">
                    <path
                      d="M9 5l7 7-7 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* miniaturas (mobile) */}
          {hasMany && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {lightbox.urls.map((u, i) => (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() =>
                    setLightbox((s) => (s ? { ...s, index: i } : s))
                  }
                  className={[
                    "shrink-0 h-16 w-16 rounded-xl overflow-hidden flex items-center justify-center",
                    "border-2 bg-white",
                    i === lightbox.index ? "border-sky-500" : "border-white/30",
                  ].join(" ")}
                  title={`Imagem ${i + 1}`}
                >
                  <img
                    src={u}
                    alt={`${lightbox.alt} - ${i + 1}`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* infos (glass) */}
        <div className="px-3 py-4 space-y-3 text-white">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {brand ? (
              <div className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center justify-start gap-3">
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-black text-white ring-1 ring-white/10">
                    MARCA:
                  </span>

                  <span className="text-sm font-black text-white truncate">
                    {brand}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {lightbox.product.sku?.trim() ? (
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
              <div className="inline-flex items-center gap-2">
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-black text-white ring-1 ring-white/10">
                  CÓDIGO:
                </span>
                <span className="text-sm font-black text-white">
                  {lightbox.product.sku}
                </span>
              </div>
            </div>
          ) : null}

          {lightbox.product.description ? (
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
              <div className="text-[11px] font-black text-white/90">
                DESCRIÇÃO
              </div>
              <div className="mt-1 text-sm text-white leading-relaxed">
                {lightbox.product.description}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
            <div className="text-[11px] font-black text-white/90">COR</div>

            {Array.isArray(lightbox.product.colors) &&
            lightbox.product.colors.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {lightbox.product.colors.map((c) => (
                  <span
                    key={`${lightbox.product.id}-${c.name}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15"
                    title={c.name}
                  >
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-black/25 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="whitespace-nowrap text-white">
                      {c.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-white/70">&nbsp;</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
              <div className="text-[11px] font-black text-white/90">
                EMBALAGEM
              </div>
              <div className="mt-1 font-semibold text-white leading-tight">
                {formatPack(
                  lightbox.product.unit ?? "",
                  lightbox.product.packQty ?? null,
                ) || <span>&nbsp;</span>}
              </div>
            </div>

            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md">
              <div className="text-[11px] font-black text-white/90">PREÇO</div>
              <div className="mt-1 text-base font-black text-white">
                {formatPriceCents(lightbox.product.priceCents ?? null) || (
                  <span>&nbsp;</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* DESKTOP */
  const DesktopModal = (
    <div
      className="fixed inset-0 z-50 bg-white"
      onClick={closeLightbox}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex items-center justify-center px-12 py-3 shrink-0"
          style={{
            background:
              "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 45%, rgb(255,122,0) 100%)",
          }}
        >
          <div className="text-white font-black text-center leading-snug line-clamp-2 max-w-full px-2">
            {lightbox.alt}
          </div>

          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-lg bg-white/15 px-3 py-1.5 text-white font-black hover:bg-white/25"
            title="Fechar"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4">
          <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[92px_1fr_420px] gap-4">
            {/* miniaturas (desktop) */}
            <div className="hidden lg:block">
              {hasMany ? (
                <div className="h-full overflow-y-auto pr-1 space-y-2">
                  {lightbox.urls.map((u, i) => (
                    <button
                      key={`${u}-${i}`}
                      type="button"
                      onClick={() =>
                        setLightbox((s) => (s ? { ...s, index: i } : s))
                      }
                      className={[
                        "w-full h-[72px] rounded-xl bg-white overflow-hidden flex items-center justify-center",
                        "border-2",
                        i === lightbox.index
                          ? "border-sky-500"
                          : "border-zinc-200 hover:border-zinc-300",
                      ].join(" ")}
                      title={`Imagem ${i + 1}`}
                    >
                      <img
                        src={u}
                        alt={`${lightbox.alt} - ${i + 1}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full" />
              )}
            </div>

            {/* imagem grande */}
            <div className="min-h-0 flex flex-col">
              <div className="relative flex-1 min-h-0 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  className="w-full h-full flex items-center justify-center cursor-zoom-in"
                  title="Clique para ampliar"
                >
                  <img
                    src={imgUrl}
                    alt={lightbox.alt}
                    className="max-h-full max-w-full object-contain"
                    loading="eager"
                    draggable={false}
                  />
                </button>

                {hasMany && (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      disabled={lightbox.index === 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-30"
                      title="Anterior"
                      aria-label="Anterior"
                    >
                      <svg viewBox="0 0 24 24" className="h-8 w-8 text-sky-600">
                        <path
                          d="M15 5L8 12l7 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={nextImage}
                      disabled={lightbox.index >= lightbox.urls.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-30"
                      title="Próxima"
                      aria-label="Próxima"
                    >
                      <svg viewBox="0 0 24 24" className="h-8 w-8 text-sky-600">
                        <path
                          d="M9 5l7 7-7 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </>
                )}

                <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white hidden sm:block">
                  Clique para ampliar
                </div>
              </div>

              {/* miniaturas (mobile/tablet dentro do modal) */}
              {hasMany && (
                <div className="mt-3 lg:hidden flex gap-2 overflow-x-auto pb-1">
                  {lightbox.urls.map((u, i) => (
                    <button
                      key={`${u}-${i}`}
                      type="button"
                      onClick={() =>
                        setLightbox((s) => (s ? { ...s, index: i } : s))
                      }
                      className={[
                        "shrink-0 h-16 w-16 rounded-xl bg-white overflow-hidden flex items-center justify-center",
                        "border-2",
                        i === lightbox.index
                          ? "border-sky-500"
                          : "border-zinc-200 hover:border-zinc-300",
                      ].join(" ")}
                      title={`Imagem ${i + 1}`}
                    >
                      <img
                        src={u}
                        alt={`${lightbox.alt} - ${i + 1}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* infos (direita) */}
            <div className="min-h-0">
              <div className="h-full min-h-0 overflow-y-auto pr-1 space-y-3">
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                  {/* marca no bloco de infos (desktop) */}
                  {brand ? (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-black text-zinc-700 ring-1 ring-zinc-200">
                        MARCA:
                      </span>
                      <span className="text-sm font-black text-zinc-900">
                        {brand}
                      </span>
                    </div>
                  ) : null}

                  {lightbox.product.sku?.trim() ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-900 ring-1 ring-blue-900/10">
                        CÓDIGO:
                      </span>
                      <span className="text-xs font-black text-zinc-700 tracking-wide">
                        {lightbox.product.sku}
                      </span>
                    </div>
                  ) : null}

                  {lightbox.product.description ? (
                    <div className="mt-3">
                      <div className="text-[11px] font-black text-zinc-700">
                        DESCRIÇÃO
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 leading-relaxed">
                        {lightbox.product.description}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200">
                      <div className="text-[11px] font-black text-zinc-700">
                        COR
                      </div>

                      {Array.isArray(lightbox.product.colors) &&
                      lightbox.product.colors.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lightbox.product.colors.map((c) => (
                            <span
                              key={`${lightbox.product.id}-${c.name}`}
                              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-zinc-200"
                              title={c.name}
                            >
                              <span
                                className="h-3 w-3 rounded-full ring-1 ring-black/20 shrink-0"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span className="whitespace-nowrap">
                                {c.name}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-zinc-500">&nbsp;</div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200">
                        <div className="text-[11px] font-black text-zinc-700">
                          EMBALAGEM
                        </div>
                        <div className="mt-1 font-semibold leading-tight">
                          {formatPack(
                            lightbox.product.unit ?? "",
                            lightbox.product.packQty ?? null,
                          ) || <span>&nbsp;</span>}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200">
                        <div className="text-[11px] font-black text-zinc-700">
                          PREÇO
                        </div>
                        <div className="mt-1 text-base font-black text-zinc-800">
                          {formatPriceCents(
                            lightbox.product.priceCents ?? null,
                          ) || <span>&nbsp;</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? MobilePage : DesktopModal}

      {/* zoom fullscreen (compartilhado) */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 p-4 flex items-center justify-center"
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-[96vw] h-[92vh] rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/15 px-4 py-2 text-white font-black hover:bg-white/25"
              title="Fechar"
              aria-label="Fechar"
            >
              ✕
            </button>

            <div className="w-full h-full flex items-center justify-center">
              <img
                src={imgUrl}
                alt={lightbox.alt}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  disabled={lightbox.index === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/35 p-3 text-white shadow-lg backdrop-blur-sm disabled:opacity-30"
                  title="Anterior"
                  aria-label="Anterior"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10 text-white">
                    <path
                      d="M15 5L8 12l7 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={nextImage}
                  disabled={lightbox.index >= lightbox.urls.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/35 p-3 text-white shadow-lg backdrop-blur-sm disabled:opacity-30"
                  title="Próxima"
                  aria-label="Próxima"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10 text-white">
                    <path
                      d="M9 5l7 7-7 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
