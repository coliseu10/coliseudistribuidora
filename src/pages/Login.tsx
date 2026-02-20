import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { auth } from "../lib/firebase";

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

type LocationState = { from?: { pathname?: string } };

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Falha no login";
}

export default function Login() {
  const nav = useNavigate();
  const location = useLocation() as ReturnType<typeof useLocation> & {
    state?: LocationState;
  };

  const from = location.state?.from?.pathname ?? "/admin";

  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggedEmail, setLoggedEmail] = useState<string>("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      const userEmail = (u?.email ?? "").trim().toLowerCase();
      setLoggedEmail(userEmail);

      if (ADMIN_EMAIL && userEmail === ADMIN_EMAIL) {
        nav(from, { replace: true });
      }
    });
  }, [nav, from]);

  async function entrar() {
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      nav(from, { replace: true });
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const adminMismatch =
    !!loggedEmail && !!ADMIN_EMAIL && loggedEmail !== ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-5">
        <div className="text-xl font-semibold">Login Admin</div>

        {/* Diagnóstico visível */}
        <div className="mt-2 rounded-lg border bg-zinc-50 p-2 text-xs text-zinc-700">
          <div><b>Admin (env):</b> {ADMIN_EMAIL || "(vazio)"}</div>
          <div><b>Logado como:</b> {loggedEmail || "(não logado)"}</div>
          {adminMismatch && (
            <div className="mt-1 text-red-600">
              Você está autenticado, mas com um e-mail diferente do admin.
            </div>
          )}
        </div>

        <label className="mt-4 block text-sm font-medium">Email</label>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mt-3 block text-sm font-medium">Senha</label>
        <input
          type="password"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <button
          onClick={entrar}
          disabled={loading || !email.trim() || password.length < 6}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <Link
          to="/"
          className="mt-3 block text-center text-sm text-zinc-600 hover:underline"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </div>
  );
}