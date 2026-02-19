import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold">
          Catálogo Elétrico
        </Link>
      </div>
    </header>
  );
}
