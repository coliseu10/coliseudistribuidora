import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Link } from "react-router-dom";

import ProdutosPanel, { type ProductIntent } from "../admin/ProdutosPainel";
import CategoriasPanel from "../admin/CategoriasiPanel";

export default function Admin() {
  const [tab, setTab] = useState<"produtos" | "categorias">("categorias");

  // intent para abrir modal do ProdutosPanel vindo da aba Categorias
  const [intent, setIntent] = useState<ProductIntent | null>(null);

  function clearIntent() {
    setIntent(null);
  }

  function handleEditProduct(id: string) {
    setIntent({ type: "edit", id });
    setTab("produtos");
  }

  // ✅ ALTERADO: agora recebe também o segmento vindo do CategoriasPanel
  function handleNewProduct(
    categoryName: string,
    segment?: "iluminacao" | "utensilios",
  ) {
    setIntent({ type: "new", category: categoryName, segment });
    setTab("produtos");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold">Admin</div>
            <div className="text-sm text-zinc-600">Painel único</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/" className="rounded-lg border px-4 py-2 text-sm bg-white">
              Home
            </Link>

            <button
              onClick={() => setTab("categorias")}
              className={`rounded-lg border px-4 py-2 text-sm ${
                tab === "categorias" ? "bg-black text-white" : "bg-white"
              }`}
            >
              Categorias
            </button>

            <button
              onClick={() => setTab("produtos")}
              className={`rounded-lg border px-4 py-2 text-sm ${
                tab === "produtos" ? "bg-black text-white" : "bg-white"
              }`}
            >
              Produtos
            </button>

            <button
              onClick={() => signOut(auth)}
              className="rounded-lg border px-4 py-2 text-sm bg-white"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="mt-6">
          {tab === "produtos" ? (
            <ProdutosPanel intent={intent} clearIntent={clearIntent} />
          ) : (
            <CategoriasPanel
              onEditProduct={handleEditProduct}
              onNewProduct={handleNewProduct} // ✅ agora combina (name, segment)
            />
          )}
        </div>
      </div>
    </div>
  );
}