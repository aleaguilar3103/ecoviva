import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeaderProps {
  onWhatsAppClick?: () => void;
}

export default function Header({
  onWhatsAppClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank"),
}: HeaderProps) {
  const { t } = useLanguage();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000469edac70e1d55bc3f3.png"
              alt="Eco Viva Desarrollos"
              className="h-12 w-auto"
            />
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              {t("header.inicio")}
            </button>
            <button
              onClick={() => scrollToSection("projects")}
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              {t("header.proyectos")}
            </button>
            <button
              onClick={() => scrollToSection("calculadora-financiamiento")}
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              {t("header.calculadora")}
            </button>
            <button
              onClick={() => scrollToSection("financing")}
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              {t("header.financiamiento")}
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              {t("header.contacto")}
            </button>
          </nav>

          {/* Language Switcher & WhatsApp CTA Button */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button
              onClick={onWhatsAppClick}
              className="bg-accent hover:bg-accent/90 text-white gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline">
                {t("header.hablarAhora")}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
