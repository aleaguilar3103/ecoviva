import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const switchTo = language === "es" ? "en" : "es";
  const label = language === "es" ? "EN" : "ES";

  return (
    <button
      onClick={() => setLanguage(switchTo)}
      className="text-sm font-medium tracking-wide transition-all duration-200 px-2 py-1"
      style={{ color: "rgba(255,255,255,0.65)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#74CE52")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
      aria-label={`Switch to ${switchTo === "en" ? "English" : "Español"}`}
    >
      {label}
    </button>
  );
}
