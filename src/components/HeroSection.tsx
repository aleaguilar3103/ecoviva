import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeroSectionProps {
  onCTAClick?: () => void;
}

export default function HeroSection({
  onCTAClick = () =>
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" }),
}: HeroSectionProps) {
  const { t } = useLanguage();
  return (
    <section className="relative h-screen min-h-[600px] flex items-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-top bg-no-repeat"
        style={{
          backgroundImage: `url('https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000dd3edac70812a5cac20.webp')`,
        }}
      />
      {/* Full-screen gradient from right to left, ending before middle */}
      <div
        className="absolute inset-0 bg-gradient-to-l from-transparent via-black/60 to-black/80"
        style={{
          background:
            "linear-gradient(to left, transparent 50%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 lg:px-8 flex items-center h-full">
        <div className="max-w-2xl text-left md:text-left text-center">
          <h1 className="text-[28px] sm:text-[36px] md:text-[42px] lg:text-[46px] font-bold text-white mb-4 leading-tight">
            {t("hero.title")}
          </h1>
          <h2
            className="text-[20px] sm:text-[24px] md:text-[28px] lg:text-[30px] font-semibold mb-4"
            style={{ color: "#74CE52" }}
          >
            {t("hero.subtitle")}
          </h2>

          <Button
            onClick={onCTAClick}
            size="lg"
            className="text-sm sm:text-base rounded-lg shadow-xl hover:shadow-2xl transition-all"
            style={{
              backgroundColor: "white",
              color: "#3A6829",
              padding: "14px 32px",
            }}
          >
            {t("hero.cta")}
          </Button>
        </div>
      </div>
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
}
