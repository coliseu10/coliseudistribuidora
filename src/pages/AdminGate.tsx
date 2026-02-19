import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate, useLocation } from "react-router-dom";
import { auth } from "../lib/firebase";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

export default function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "no">("loading");
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const ok = !!u?.email && u.email === ADMIN_EMAIL;
      setStatus(ok ? "ok" : "no");
    });
    return () => unsub();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-zinc-600">
        Verificando acesso...
      </div>
    );
  }

  if (status === "no") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
