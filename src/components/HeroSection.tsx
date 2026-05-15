import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronLeft, ChevronRight, MapPin, ArrowDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const slides = [
  {
    id: "both-projects",
    image: "https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000dd3edac70812a5cac20.webp",
    titleKey: "hero.title",
    subtitleKey: "hero.subtitle",
    descriptionKey: "hero.description",
    ctaKey: "hero.cta",
    ctaAction: "projects",
    location: "Zona Norte, Costa Rica",
  },
  {
    id: "rio-celeste",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f5f42dd98576bbee6e8b.jpg",
    titleKey: "projects.rioCeleste.title",
    subtitleKey: "projects.rioCeleste.location",
    descriptionKey: "projects.rioCeleste.description",
    ctaKey: "projects.rioCeleste.viewDetails",
    ctaAction: "rioCeleste",
    location: "Upala, Alajuela",
  },
  {
    id: "lomas-llanada",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f51e0708e42ab38c2735.jpg",
    titleKey: "projects.llanadaViews.title",
    subtitleKey: "projects.llanadaViews.location",
    descriptionKey: "projects.llanadaViews.description",
    ctaKey: "projects.llanadaViews.viewDetails",
    ctaAction: "lomasLlanada",
    location: "Ciudad Quesada, San Carlos",
  },
  {
    id: "financing",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f6cc0708e42b488c5dc9.jpg",
    titleKey: "financing.title",
    subtitleKey: "financing.subtitle",
    descriptionKey: "financing.highlight",
    ctaKey: "financing.cta",
    ctaAction: "financing",
    location: "Costa Rica",
  },
];

const stats = [
  { value: "2", label: "Proyectos" },
  { value: "+40", label: "Lotes" },
  { value: "$0", label: "Prima inicial" },
  { value: "15", label: "Años plazo" },
];

export default function HeroSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [textVisible, setTextVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const goTo = (idx: number) => {
    if (idx === current) return;
    setTextVisible(false);
    setTimeout(() => {
      setPrev(current);
      setCurrent(idx);
      setTextVisible(true);
    }, 350);
  };

  useEffect(() => {
    if (isPaused) return;
    intervalRef.current = setInterval(() => goTo((current + 1) % slides.length), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [current, isPaused]);

  const handleCTA = () => {
    setIsPaused(true);
    const a = slides[current].ctaAction;
    if (a === "projects") document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
    else if (a === "rioCeleste") navigate("/rio-celeste-oasis-detalle");
    else if (a === "lomasLlanada") navigate("/lomas-de-la-llanada-detalle");
    else if (a === "financing") document.getElementById("financing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section data-section="hero" className="relative h-screen min-h-[680px] flex flex-col overflow-hidden">
      {/* Slides background */}
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('${slide.image}')`,
              transform: i === current ? "scale(1)" : "scale(1.05)",
              transition: i === current ? "transform 8000ms linear" : "none",
            }}
          />
          {/* Multi-layer dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        </div>
      ))}

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2, opacity: 0.03,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative flex-1 flex items-center" style={{ zIndex: 3, paddingTop: "120px" }}>
        <div className="container mx-auto px-6 lg:px-12">
          <div className="max-w-3xl">
            {/* Location pill */}
            <div
              className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-all duration-500"
              style={{
                borderColor: "rgba(116,206,82,0.4)",
                backgroundColor: "rgba(116,206,82,0.08)",
                color: "#74CE52",
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0)" : "translateY(8px)",
                transitionDelay: "0ms",
              }}
            >
              <MapPin className="w-3 h-3" />
              {slides[current].location}
            </div>

            {/* Headline */}
            <h1
              className="font-bold text-white leading-[1.05] mb-4 transition-all duration-500"
              style={{
                fontSize: "clamp(2.2rem, 5.5vw, 4rem)",
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: "60ms",
              }}
            >
              {t(slides[current].titleKey)}
            </h1>

            {/* Subheadline */}
            <p
              className="font-semibold mb-4 transition-all duration-500"
              style={{
                fontSize: "clamp(1rem, 2.2vw, 1.4rem)",
                color: "#74CE52",
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: "120ms",
              }}
            >
              {t(slides[current].subtitleKey)}
            </p>

            {/* Description */}
            <p
              className="text-white/70 text-base md:text-lg mb-8 max-w-xl leading-relaxed transition-all duration-500 line-clamp-2"
              style={{
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: "180ms",
              }}
            >
              {t(slides[current].descriptionKey)}
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap gap-3 transition-all duration-500"
              style={{
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: "240ms",
              }}
            >
              <Button
                onClick={handleCTA}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                size="lg"
                className="rounded-xl font-semibold shadow-2xl transition-all duration-300 hover:scale-[1.03]"
                style={{ backgroundColor: "#74CE52", color: "#0d1a10", padding: "14px 32px", fontSize: "0.95rem" }}
              >
                {t(slides[current].ctaKey)}
              </Button>
              <Button
                onClick={() => { setIsPaused(true); document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" }); }}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                size="lg"
                variant="outline"
                className="rounded-xl font-semibold border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                style={{ padding: "14px 28px", fontSize: "0.95rem" }}
              >
                Ver proyectos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative w-full" style={{ zIndex: 3 }}>
        <div className="container mx-auto px-6 lg:px-12 pb-8">
          <div className="flex flex-wrap gap-px overflow-hidden rounded-2xl border border-white/10 backdrop-blur-md max-w-xl"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
            {stats.map(({ value, label }, i) => (
              <div key={i} className="flex-1 min-w-[80px] flex flex-col items-center py-3 px-2 border-r border-white/10 last:border-r-0">
                <span className="text-xl font-bold" style={{ color: "#74CE52" }}>{value}</span>
                <span className="text-[11px] text-white/50 mt-0.5 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide navigation arrows */}
      <button
        onClick={() => goTo((current - 1 + slides.length) % slides.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border border-white/20 bg-black/20 hover:bg-white/10 backdrop-blur-sm transition-all"
        style={{ zIndex: 4 }}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={() => goTo((current + 1) % slides.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border border-white/20 bg-black/20 hover:bg-white/10 backdrop-blur-sm transition-all"
        style={{ zIndex: 4 }}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Slide dots */}
      <div className="absolute bottom-8 right-6 flex gap-2" style={{ zIndex: 4 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-400"
            style={{
              width: i === current ? "28px" : "8px",
              height: "8px",
              backgroundColor: i === current ? "#74CE52" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style={{ zIndex: 4 }}>
        <ArrowDown className="w-4 h-4 text-white/40" />
      </div>
    </section>
  );
}
