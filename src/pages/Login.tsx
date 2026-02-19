import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { auth } from "../lib/firebase";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

export default function Login() {
  const nav = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from ?? "/admin";

  const [email, setEmail] = useState(ADMIN_EMAIL ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u?.email && u.email === ADMIN_EMAIL) {
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
    } catch (e: any) {
      setErr(e?.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-5">
        <div className="text-xl font-semibold">Login Admin</div>
        <div className="text-sm text-zinc-600 mt-1">
          Entre para gerenciar produtos
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
