import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface HeroSectionProps {
  onCTAClick?: () => void;
}

const slides = [
  {
    id: "both-projects",
    image: "https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000dd3edac70812a5cac20.webp",
    titleKey: "hero.title",
    subtitleKey: "hero.subtitle",
    descriptionKey: "hero.description",
    ctaKey: "hero.cta",
    ctaAction: "projects"
  },
  {
    id: "rio-celeste",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f5f42dd98576bbee6e8b.jpg",
    titleKey: "projects.rioCeleste.title",
    subtitleKey: "projects.rioCeleste.location",
    descriptionKey: "projects.rioCeleste.description",
    ctaKey: "projects.rioCeleste.viewDetails",
    ctaAction: "rioCeleste"
  },
  {
    id: "lomas-llanada",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f51e0708e42ab38c2735.jpg",
    titleKey: "projects.llanadaViews.title",
    subtitleKey: "projects.llanadaViews.location",
    descriptionKey: "projects.llanadaViews.description",
    ctaKey: "projects.llanadaViews.viewDetails",
    ctaAction: "lomasLlanada"
  },
  {
    id: "financing",
    image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6982f6cc0708e42b488c5dc9.jpg",
    titleKey: "financing.title",
    subtitleKey: "financing.subtitle",
    descriptionKey: "financing.highlight",
    ctaKey: "financing.cta",
    ctaAction: "financing"
  }
];

export default function HeroSection({
  onCTAClick = () =>
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" }),
}: HeroSectionProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startAutoPlay = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 4500);
    };

    if (!isPaused) {
      startAutoPlay();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const handleButtonMouseEnter = () => {
    setIsPaused(true);
  };

  const handleButtonMouseLeave = () => {
    setIsPaused(false);
  };

  const handleCTA = () => {
    const slide = slides[currentSlide];
    if (slide.ctaAction === "projects") {
      document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
    } else if (slide.ctaAction === "rioCeleste") {
      navigate("/rio-celeste-oasis-detalle");
    } else if (slide.ctaAction === "lomasLlanada") {
      navigate("/lomas-de-la-llanada-detalle");
    } else if (slide.ctaAction === "financing") {
      document.getElementById("financing")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section data-section="hero" className="relative h-screen min-h-[600px] flex items-center overflow-hidden pt-[120px]">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('${slide.image}')`,
            }}
          />
          {/* Gradient Overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-l from-transparent via-black/60 to-black/80"
            style={{
              background:
                "linear-gradient(to left, transparent 50%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)",
            }}
          />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 lg:px-8 flex items-center h-full">
        <div className="max-w-2xl text-left md:text-left text-center">
          <h1 className="text-[28px] sm:text-[36px] md:text-[42px] lg:text-[46px] font-bold text-white mb-4 leading-tight">
            {t(slides[currentSlide].titleKey)}
          </h1>
          <h2
            className="text-[20px] sm:text-[24px] md:text-[28px] lg:text-[30px] font-semibold mb-4"
            style={{ color: "#74CE52" }}
          >
            {t(slides[currentSlide].subtitleKey)}
          </h2>
          <p className="text-white/90 text-base sm:text-lg mb-6 line-clamp-3">
            {t(slides[currentSlide].descriptionKey)}
          </p>

          <Button
            onClick={handleCTA}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
            size="lg"
            className="text-sm sm:text-base rounded-lg shadow-xl hover:shadow-2xl transition-all"
            style={{
              backgroundColor: "white",
              color: "#3A6829",
              padding: "14px 32px",
            }}
          >
            {t(slides[currentSlide].ctaKey)}
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 flex gap-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`transition-all rounded-full ${
              index === currentSlide
                ? "bg-white w-8 h-3"
                : "bg-white/50 hover:bg-white/70 w-3 h-3"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
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
