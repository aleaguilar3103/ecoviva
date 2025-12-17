import { Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-primary text-white py-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-4">
              {t("footer.brand")}{" "}
              <span className="text-accent">{t("footer.brandAccent")}</span>
            </h3>
            <p className="text-white/80">{t("footer.tagline")}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">
              {t("footer.quickLinks")}
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {t("footer.inicio")}
                </a>
              </li>
              <li>
                <a
                  href="#projects"
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {t("footer.proyectos")}
                </a>
              </li>
              <li>
                <a
                  href="#financing"
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {t("footer.financiamiento")}
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {t("footer.contacto")}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">
              {t("footer.contactTitle")}
            </h4>
            <div className="space-y-3">
              <a
                href="https://api.whatsapp.com/send?phone=50684142111"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-white/80 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 mr-2" />
                <span>{t("footer.whatsapp")}</span>
              </a>
              <div className="flex items-center text-white/80">
                <Mail className="w-4 h-4 mr-2" />
                <span>info@ecovivadesarrollos.com</span>
              </div>
              <div className="flex items-center text-white/80">
                <MapPin className="w-4 h-4 mr-2" />
                <span>Zona Norte, Costa Rica</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/20 pt-8 text-center text-white/60">
          <p>{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
