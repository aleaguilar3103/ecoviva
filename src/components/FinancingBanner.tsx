import { Button } from "@/components/ui/button";
import { CreditCard, Check, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

interface FinancingBannerProps {
  variant?: "header" | "floating" | "inline";
  className?: string;
}

export default function FinancingBanner({ variant = "inline", className = "" }: FinancingBannerProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleApplyClick = () => {
    navigate("/survey");
  };

  if (variant === "header") {
    return (
      <div className={`py-2 ${className}`} style={{ backgroundColor: "#080d09", borderBottom: "1px solid rgba(116,206,82,0.15)" }}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
              <CreditCard className="w-4 h-4" style={{ color: "#74CE52" }} />
              <span>{t("financingBanner.headline")}</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                {t("financingBanner.noPrima")}
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                {t("financingBanner.noFiador")}
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                {t("financingBanner.soloCedula")}
              </span>
            </div>
            <button
              onClick={handleApplyClick}
              className="text-xs h-7 px-3 rounded-md font-medium transition-all duration-200"
              style={{ backgroundColor: "rgba(116,206,82,0.12)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.25)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(116,206,82,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(116,206,82,0.12)"; }}
            >
              {t("financingBanner.cta")}
              <ArrowRight className="w-3 h-3 ml-1 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "floating") {
    return (
      <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-40 ${className}`}>
        <div className="bg-gradient-to-r from-primary to-primary/90 text-white p-4 rounded-lg shadow-2xl border border-white/20 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-accent" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">{t("financingBanner.headline")}</p>
                <p className="text-xs text-white/80">{t("financingBanner.subheadline")}</p>
              </div>
            </div>
            <Button
              onClick={handleApplyClick}
              className="bg-accent hover:bg-accent/90 text-white whitespace-nowrap"
            >
              {t("financingBanner.cta")}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // inline variant (default)
  return (
    <div className={`bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6 ${className}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <CreditCard className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-primary">{t("financingBanner.headline")}</h3>
            <p className="text-sm text-gray-600 mt-1">{t("financingBanner.subheadline")}</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <Check className="w-3 h-3" />
                {t("financingBanner.noPrima")}
              </span>
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <Check className="w-3 h-3" />
                {t("financingBanner.noFiador")}
              </span>
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <Check className="w-3 h-3" />
                {t("financingBanner.soloCedula")}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleApplyClick}
          className="bg-accent hover:bg-accent/90 text-white px-6"
        >
          {t("financingBanner.cta")}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
