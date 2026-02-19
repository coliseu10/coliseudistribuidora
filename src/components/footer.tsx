export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 text-center text-sm text-zinc-600">
        © {new Date().getFullYear()} Coliseu Distriubuidora.  
        <span className="mx-1">•</span>
        Todos os direitos reservados.
      </div>
    </footer>
  );
}
