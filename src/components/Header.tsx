import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import FinancingBanner from "@/components/FinancingBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

interface HeaderProps {
  onWhatsAppClick?: () => void;
}

export default function Header({
  onWhatsAppClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank"),
}: HeaderProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const heroHeight = useRef(0);

  const isHomePage = location.pathname === "/";

  useEffect(() => {
    // Get the hero section height (first section after header)
    const heroSection = document.querySelector('[data-section="hero"]') || document.querySelector('section');
    if (heroSection) {
      heroHeight.current = heroSection.getBoundingClientRect().height;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingUp = currentScrollY < lastScrollY.current;
      
      // If scrolling up, always show header
      if (scrollingUp) {
        setIsVisible(true);
      } else {
        // If scrolling down and past the first section, hide header
        if (currentScrollY > heroHeight.current) {
          setIsVisible(false);
        }
      }
      
      // At top of page, always show
      if (currentScrollY < 100) {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    if (isHomePage) {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: id } });
    }
  };

  const goHome = () => {
    if (isHomePage) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <FinancingBanner variant="header" />
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={goHome}>
            <img
              src="https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000469edac70e1d55bc3f3.png"
              alt="Eco Viva Desarrollos"
              className="h-12 w-auto"
            />
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={goHome}
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
    </div>
  );
}
