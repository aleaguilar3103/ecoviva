import { Button } from "@/components/ui/button";
import { MessageCircle, Menu, X } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      setVisible(y < lastScrollY.current || y < 120);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    if (isHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: id } });
    }
  };

  const goHome = () => {
    setMobileOpen(false);
    if (isHome) window.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/");
  };

  const navLinks = [
    { label: t("header.inicio"), action: goHome },
    { label: t("header.proyectos"), action: () => scrollTo("projects") },
    { label: t("header.calculadora"), action: () => scrollTo("calculadora-financiamiento") },
    { label: t("header.financiamiento"), action: () => scrollTo("financing") },
    { label: t("header.contacto"), action: () => scrollTo("contact") },
  ];

  // Transparent over hero when at top, dark solid when scrolled — on ALL pages
  const atTop = !scrolled;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${visible ? "translate-y-0" : "-translate-y-full"}`}
    >
      <FinancingBanner variant="header" />

      <header
        className="transition-all duration-400"
        style={{
          backgroundColor: atTop ? "rgba(8,13,9,0.18)" : "rgba(8,13,9,0.97)",
          backdropFilter: "blur(18px)",
          borderBottom: atTop ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-18" style={{ height: "72px" }}>
            {/* Logo */}
            <div className="cursor-pointer flex-shrink-0" onClick={goHome}>
              <img
                src="https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000469edac70e1d55bc3f3.png"
                alt="Eco Viva Desarrollos"
                className="h-11 w-auto"
              />
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-7">
              {navLinks.map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="text-sm font-medium transition-colors duration-200"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#74CE52")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                onClick={onWhatsAppClick}
                className="gap-2 font-semibold text-sm rounded-xl hidden sm:flex"
                style={{ backgroundColor: "#74CE52", color: "#0d1a10", border: "none" }}
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t("header.hablarAhora")}</span>
              </Button>
              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 rounded-lg"
                style={{ color: "white" }}
                onClick={() => setMobileOpen(o => !o)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="md:hidden border-t py-4 px-4 flex flex-col gap-1"
            style={{
              backgroundColor: "rgba(10,18,12,0.98)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            {navLinks.map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="text-left px-3 py-3 rounded-lg text-white/80 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                {label}
              </button>
            ))}
            <Button
              onClick={() => { setMobileOpen(false); onWhatsAppClick(); }}
              className="mt-3 w-full gap-2 font-semibold rounded-xl"
              style={{ backgroundColor: "#74CE52", color: "#0d1a10" }}
            >
              <MessageCircle className="w-4 h-4" />
              {t("header.hablarAhora")}
            </Button>
          </div>
        )}
      </header>
    </div>
  );
}
