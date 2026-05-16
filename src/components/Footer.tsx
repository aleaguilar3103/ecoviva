import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useNavigate } from "react-router-dom";

export default function Footer() {
  const { t } = useLanguage();
  const localePath = useLocalePath();
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else navigate(localePath("/"), { state: { scrollTo: id } });
  };

  return (
    <footer style={{ backgroundColor: "#080d09", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Main footer */}
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <img
              src="https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000469edac70e1d55bc3f3.png"
              alt="Eco Viva Desarrollos"
              className="h-12 w-auto mb-4"
            />
            <p className="text-sm text-white/40 leading-relaxed max-w-xs mb-6">{t("footer.tagline")}</p>
            {/* Highlight pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}
            >
              <span className="w-2 h-2 rounded-full bg-[#74CE52] animate-pulse" />
              Financiamiento directo, sin banco
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-5">Navegación</p>
            <ul className="space-y-3">
              {[
                { label: t("footer.inicio"), action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
                { label: t("footer.proyectos"), action: () => scrollTo("projects") },
                { label: t("footer.financiamiento"), action: () => scrollTo("financing") },
                { label: t("footer.contacto"), action: () => scrollTo("contact") },
              ].map(({ label, action }) => (
                <li key={label}>
                  <button
                    onClick={action}
                    className="flex items-center gap-1.5 text-sm text-white/45 hover:text-white transition-colors group"
                  >
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all duration-200" style={{ color: "#74CE52" }} />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-5">{t("footer.contactTitle")}</p>
            <div className="space-y-4">
              <a
                href="https://api.whatsapp.com/send?phone=50684142111"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#74CE52" }} />
                <span className="text-sm text-white/50 group-hover:text-white transition-colors">{t("footer.whatsapp")}</span>
              </a>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#74CE52" }} />
                <span className="text-sm text-white/50">info@ecovivadesarrollos.com</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#74CE52" }} />
                <span className="text-sm text-white/50">Zona Norte, Costa Rica</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="container mx-auto px-4 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">{t("footer.copyright")}</p>
          <p className="text-xs text-white/20">Zona Norte · Ciudad Quesada · Costa Rica</p>
        </div>
      </div>
    </footer>
  );
}
