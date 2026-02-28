import { useEffect, useMemo, useRef, useState } from "react";
import { listProducts } from "../lib/produtos";
import type { Product } from "../lib/produtos";

// ✅ NOVO (somente para ordenar/exibir conforme painel de categorias)
import { listCategories, type Category } from "../lib/categorias";

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

// ✅ NOVO: normaliza nome de categoria para comparar com/sem acento e caixa
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
};

type HomeSegment = "iluminacao" | "utensilios";
type ProductWithSegment = Product & { segment?: HomeSegment | null };

export default function Home() {
  const [items, setItems] = useState<ProductWithSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const [segment, setSegment] = useState<HomeSegment | null>(null);

  const catBarRef = useRef<HTMLDivElement | null>(null);
  const [showCatFab, setShowCatFab] = useState(false);
  const [catFabOpen, setCatFabOpen] = useState(false);

  // ✅ NOVO: categorias do painel (para ordenar e filtrar na home)
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listProducts();
        setItems(data as ProductWithSegment[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ NOVO: carrega categorias uma vez (já vem orderBy("order","asc"))
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

    // ✅ Pega somente as categorias cadastradas do segmento atual, na ordem do admin
    const catsForSegment = allCategories
      .filter((c) => c.segment === segment)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // mapa: categoria normalizada -> categoria oficial (nome + order)
    const catIndex = new Map<string, { name: string; order: number }>();
    for (const c of catsForSegment) {
      catIndex.set(normCat(c.name), { name: c.name, order: c.order });
    }

    // ✅ Agrupa apenas produtos cuja categoria existe no painel
    const map = new Map<string, ProductWithSegment[]>();
    for (const p of filtered) {
      const raw = (p.category ?? "").trim();
      if (!raw) continue; // sem categoria -> não mostra (pois você quer só as cadastradas)
      const key = normCat(raw);

      const meta = catIndex.get(key);
      if (!meta) continue; // categoria não cadastrada -> não mostra

      const catName = meta.name; // usa o nome “oficial” do painel
      const prev = map.get(catName) ?? [];
      prev.push(p);
      map.set(catName, prev);
    }

    // ✅ Agora monta a lista seguindo EXATAMENTE a ordem do admin
    const arr = catsForSegment
      .map((c) => [c.name, map.get(c.name) ?? []] as const)
      .filter(([, list]) => list.length > 0) // não mostra categoria vazia
      .map(([name, list]) => [name, list] as [string, ProductWithSegment[]]);

    // mantém sua ordenação dos produtos dentro da categoria
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
        setShowCatFab(outOfView);
        if (!outOfView) setCatFabOpen(false);
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
    // ✅ TIRADO min-h-screen (quem manda na altura agora é o App com flex)
    <div className="bg-white overflow-x-hidden">
      {/* ✅ reduzi um pouco o padding-bottom (não precisa 10 aqui) */}
      <div className="w-full px-4 py-6 lg:px-0 pb-6">
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
                      className="flex flex-col items-center gap-1 md:flex-row md:items-center md:justify-start md:gap-2 hover:opacity-90"
                    >
                      {/* ✅ label SEM círculo/borda */}
                      <span className="px-2 py-0.5 text-xs font-bold text-orange-600">
                        {p.label}
                      </span>

                      {/* ✅ número SEM underline + com ícone */}
                      <span className="inline-flex items-center gap-2 font-semibold text-zinc-900">
                        {isWhats ? (
                          /* Whats icon */
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
                          /* Phone icon */
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
                      {/* Email icon */}
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
                  <span className="inline-flex items-center gap-2">
                    {/* Globe icon */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-blue-900"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm7.93 9h-3.21a15.6 15.6 0 0 0-1.1-5.02A8.02 8.02 0 0 1 19.93 11ZM12 4c.78 0 1.95 1.55 2.62 5H9.38C10.05 5.55 11.22 4 12 4ZM4.07 13h3.21c.2 1.77.63 3.48 1.1 5.02A8.02 8.02 0 0 1 4.07 13Zm3.21-2H4.07a8.02 8.02 0 0 1 4.31-5.02A15.6 15.6 0 0 0 7.28 11ZM12 20c-.78 0-1.95-1.55-2.62-5h5.24C13.95 18.45 12.78 20 12 20Zm3.62-1.98c.47-1.54.9-3.25 1.1-5.02h3.21a8.02 8.02 0 0 1-4.31 5.02ZM9.2 13c-.07-.66-.12-1.33-.12-2s.05-1.34.12-2h5.6c.07.66.12 1.33.12 2s-.05 1.34-.12 2H9.2Z"
                      />
                    </svg>

                    {/* ✅ texto preto + site laranja */}
                    <span className="text-zinc-900">
                      Compre pelo nosso Site:
                    </span>
                    <span className="text-orange-600">{CONTACTS.site}</span>
                  </span>
                </a>
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

        {/* ✅ TELA DE ESCOLHA (ANTES DO CATÁLOGO) */}
        {!segment && (
          <div className="mt-8 lg:px-10">
            {/* ✅ removi min-height “forçado” gigante; deixa natural */}
            <div className="flex items-start md:items-center">
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ESQUERDA: ILUMINAÇÃO */}
                <button
                  type="button"
                  onClick={() => setSegment("iluminacao")}
                  className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <img
                    src="/ilumicao.png"
                    alt="Iluminação"
                    // ✅ DIMINUÍ O TAMANHO (antes era 240/320/420/480)
                    className="w-full object-cover transition group-hover:scale-105 h-[210px] sm:h-[280px] lg:h-[360px] 2xl:h-[400px]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* ✅ opcional: texto um tiquinho menor */}
                    <div className="rounded-full bg-white/15 px-6 py-3 text-white font-black text-3xl uppercase tracking-wide">
                      Iluminação
                    </div>
                  </div>
                </button>

                {/* DIREITA: UTENSÍLIOS */}
                <button
                  type="button"
                  onClick={() => setSegment("utensilios")}
                  className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <img
                    src="/utensilio.png"
                    alt="Utensílios Domésticos"
                    // ✅ DIMINUÍ O TAMANHO (igual o outro)
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

        {/* ✅ topo do catálogo + botão trocar */}
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

        {/* ✅ CATÁLOGO SÓ APARECE DEPOIS QUE ESCOLHER */}
        {segment && (
          <>
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
                            const colors = Array.isArray(p.colors)
                              ? p.colors
                              : [];
                            const urls = getProductImages(p);
                            const firstImage = urls[0] ?? "";
                            const pack = formatPack(
                              p.unit ?? "",
                              p.packQty ?? null,
                            );
                            const price = formatPriceCents(
                              p.priceCents ?? null,
                            );

                            return (
                              <article
                                key={p.id}
                                className={[
                                  "relative rounded-2xl bg-white overflow-hidden border-0 shadow-sm",
                                  p.active ? "" : "opacity-60 grayscale",
                                ].join(" ")}
                              >
                                {!p.active && (
                                  <div className="absolute top-3 left-3 z-10 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                                    Indisponível
                                  </div>
                                )}

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
                                    {/* Nome */}
                                    <div className="font-black text-zinc-700 leading-snug line-clamp-2">
                                      {p.name}
                                    </div>

                                    {/* SKU mais visível */}
                                    {p.sku?.trim() ? (
                                      <div className="mt-2 inline-flex items-center gap-2">
                                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-900 ring-1 ring-blue-900/10">
                                          CÓDIGO
                                        </span>
                                        <span className="text-xs font-black text-zinc-700 tracking-wide">
                                          {p.sku}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="mt-2 text-xs text-zinc-600">
                                        &nbsp;
                                      </div>
                                    )}

                                    {/* Descrição mais perceptível */}
                                    {p.description ? (
                                      <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 transition ">
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

                                  {/* META */}
                                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                                    {/* Linha de características */}
                                    <div className="grid grid-cols-1 gap-2">
                                      {/* COR */}
                                      <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                          <div className="text-[11px] font-black text-zinc-700 shrink-0">
                                            COR:
                                          </div>

                                          {colors.length ? (
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                              {colors.slice(0, 6).map((c) => (
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

                                              {colors.length > 6 && (
                                                <span className="text-xs font-semibold text-zinc-600 whitespace-nowrap">
                                                  +{colors.length - 6}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="text-xs text-zinc-500">
                                              &nbsp;
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* EMBALAGEM + PREÇO */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                          <div className="text-[11px] font-black text-zinc-700">
                                            EMBALAGEM
                                          </div>
                                          <div className="mt-1 font-semibold leading-tight line-clamp-2">
                                            {pack || <span>&nbsp;</span>}
                                          </div>
                                        </div>

                                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                          <div className="text-[11px] font-black text-zinc-700">
                                            PREÇO
                                          </div>
                                          <div className="mt-1 text-base font-black text-zinc-800">
                                            {price || <span>&nbsp;</span>}
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

      {/* ✅ BOTÃO FLUTUANTE (SÓ QUANDO TEM CATÁLOGO) */}
      {segment && showCatFab && categoryLinks.length > 0 && (
        <>
          {catFabOpen && (
            <div
              className="fixed inset-0 z-30"
              onClick={() => setCatFabOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className="fixed bottom-4 right-4 z-40">
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
            className="w-full max-w-4xl rounded-2xl bg-white overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER (sem botão fechar) */}
            <div className="relative flex items-center justify-center border-b pl-4 pr-20 py-3">
              <div
                className="text-center font-black leading-snug break-words line-clamp-2"
                style={{ fontSize: "clamp(12px, 1.2vw, 16px)" }}
                title={lightbox.alt}
              >
                {lightbox.alt}
              </div>

              {/* contador (mantém simples) */}
              {lightbox.urls.length > 1 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-600 whitespace-nowrap">
                  {lightbox.index + 1} / {lightbox.urls.length}
                </div>
              )}
            </div>

            {/* BODY */}
            <div className="p-4 space-y-3">
              {/* IMAGEM + SETAS LATERAIS */}
              <div className="relative">
                <img
                  src={lightbox.urls[lightbox.index]}
                  alt={lightbox.alt}
                  className="w-full max-h-[70vh] object-contain rounded-lg bg-white"
                />

                {/* seta esquerda */}
                {lightbox.urls.length > 1 && (
                  <button
                    type="button"
                    onClick={prevImage}
                    disabled={lightbox.index === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-3 disabled:opacity-30"
                    title="Anterior"
                    aria-label="Anterior"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-10 w-10 text-sky-500"
                      aria-hidden="true"
                    >
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
                )}

                {/* seta direita */}
                {lightbox.urls.length > 1 && (
                  <button
                    type="button"
                    onClick={nextImage}
                    disabled={lightbox.index >= lightbox.urls.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 disabled:opacity-30"
                    title="Próxima"
                    aria-label="Próxima"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-10 w-10 text-sky-500"
                      aria-hidden="true"
                    >
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
                )}
              </div>

              {/* MINIATURAS (só quando tem +1 imagem) */}
              {lightbox.urls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {lightbox.urls.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() =>
                        setLightbox((s) => (s ? { ...s, index: i } : s))
                      }
                      className={[
                        "shrink-0 h-16 w-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden",
                        i === lightbox.index ? "ring-2 ring-blue-500" : "",
                      ].join(" ")}
                      title={`Ver imagem ${i + 1}`}
                    >
                      <img
                        src={url}
                        alt={`${lightbox.alt} - ${i + 1}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
