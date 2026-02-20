import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

type Status = "loading" | "ok" | "no";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export default function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [currentEmail, setCurrentEmail] = useState<string>("");

  const location = useLocation() as ReturnType<typeof useLocation> & {
    state?: LocationState;
  };
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const email = (u?.email ?? "").trim().toLowerCase();
      setCurrentEmail(email);

      const ok = !!ADMIN_EMAIL && !!email && email === ADMIN_EMAIL;
      setStatus(ok ? "ok" : "no");
    });

    return unsub;
  }, []);

  // se env não entrou no build
  if (status !== "loading" && !ADMIN_EMAIL) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-4 text-sm">
          <div className="font-semibold">Configuração do Admin faltando</div>
          <div className="mt-2 text-zinc-700">
            A variável <b>VITE_ADMIN_EMAIL</b> está vazia no build.
          </div>
          <div className="mt-3 text-zinc-600">
            Netlify → Environment variables → defina <b>VITE_ADMIN_EMAIL</b> e faça{" "}
            <b>Clear cache and deploy</b>.
          </div>
          <button
            className="mt-4 w-full rounded-lg bg-black px-3 py-2 text-white text-sm"
            onClick={() => nav("/admin/login", { replace: true })}
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-zinc-600">
        Verificando acesso...
      </div>
    );
  }

  if (status === "no") {
    // diagnóstico visível + botão
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-4 text-sm">
          <div className="font-semibold">Acesso negado</div>

          <div className="mt-2 text-zinc-700">
            <div>
              <b>Admin (env):</b> {ADMIN_EMAIL || "(vazio)"}
            </div>
            <div>
              <b>Logado como:</b> {currentEmail || "(não logado)"}
            </div>
          </div>

          <button
            className="mt-4 w-full rounded-lg bg-black px-3 py-2 text-white text-sm"
            onClick={() =>
              nav("/admin/login", {
                replace: true,
                state: { from: location },
              })
            }
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}