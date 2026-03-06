import { FaWhatsapp, FaInstagram } from "react-icons/fa";

export default function Footer() {
  return (
    <footer
      className="text-white"
      style={{
        background:
          "linear-gradient(90deg, rgb(11,44,112) 0%, rgb(24,88,180) 45%, rgb(255,122,0) 100%)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-4 text-center text-sm font-semibold sm:flex-row sm:gap-4">
        <div>
          © {new Date().getFullYear()} Coliseu Distribuidora.
          <span className="mx-1">•</span>
          Todos os direitos reservados.
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://wa.me/5511917690585"
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp Coliseu Distribuidora"
            className="transition-transform hover:scale-105"
          >
            <FaWhatsapp size={40} color="#25D366" />
          </a>

          <a
            href="https://www.instagram.com/distribuidoracoliseuoficial/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram Coliseu Distribuidora"
            className="transition-transform hover:scale-105"
          >
            <FaInstagram
              size={37}
              style={{
                color: "#fff",
                background:
                  "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 45%, #6228d7 100%)",
                borderRadius: "8px",
                padding: "4px",
              }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}