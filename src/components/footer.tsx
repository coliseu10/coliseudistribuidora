export default function Footer() {
  return (
    <footer
      className="text-white"
      style={{
        background:
          "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 45%, rgb(255,122,0) 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-4 text-center text-sm font-semibold">
        © {new Date().getFullYear()} Coliseu Distribuidora.
        <span className="mx-1">•</span>
        Todos os direitos reservados.
      </div>
    </footer>
  );
}