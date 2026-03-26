import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

// ─── Assets ───────────────────────────────────────────────────────────────────

const HERO =
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e146bc515f6df1405.jpg";

const CAROUSEL = [
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e6b0a70ae03223880.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e52ad3bc301da4b5c.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e350cfe580a318cce.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e81e6bc935b6b211c.jpg",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FunnelLlanada() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const goToFunnel = () => navigate("/funnel");
  const prev = () => setSlide((s) => (s - 1 + CAROUSEL.length) % CAROUSEL.length);
  const next = () => setSlide((s) => (s + 1) % CAROUSEL.length);

  return (
    <div className="bg-white text-gray-900 min-h-screen">

      {/* ── HERO — partial height so text section is visible on entry ── */}
      <div
        className="w-full overflow-hidden"
        style={{ height: "58vw", maxHeight: "400px", minHeight: "200px" }}
      >
        <img
          src={HERO}
          alt="Lomas de la Llanada"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* ── SECTION 1: badge · headline · description · CTA ── */}
      <section className="px-6 pt-8 pb-10 text-center max-w-lg mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          Preventa de lotes
        </p>
        <h1 className="text-[1.75rem] font-bold leading-snug mb-4">
          Eco-Comunidad privada en Ciudad Quesada
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          Descubra Lomas de la Llanada, una eco comunidad privada con lotes
          amplios, acceso controlado y alto potencial de plusvalía en una de las
          zonas con mayor proyección de Ciudad Quesada.
        </p>
        <button
          onClick={goToFunnel}
          className="w-full border-2 border-gray-900 text-gray-900 font-semibold text-lg py-4 rounded-2xl hover:bg-gray-900 hover:text-white transition-colors duration-200"
        >
          Agende una visita
        </button>
      </section>

      {/* ── CAROUSEL ── */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/10" }}>
        <img
          src={CAROUSEL[slide]}
          alt={`Vista ${slide + 1}`}
          className="w-full h-full object-cover"
        />

        {/* Prev */}
        {slide > 0 && (
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 flex items-center justify-center shadow-md"
          >
            <ChevronLeft className="w-5 h-5 text-gray-800" />
          </button>
        )}

        {/* Next */}
        {slide < CAROUSEL.length - 1 && (
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 flex items-center justify-center shadow-md"
          >
            <ChevronRight className="w-5 h-5 text-gray-800" />
          </button>
        )}

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {CAROUSEL.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Imagen ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full border border-white/50 transition-colors duration-200 ${
                i === slide ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── SECTION 2: details · second CTA · back-to-top ── */}
      <section className="px-6 pt-8 pb-12 text-center max-w-lg mx-auto">
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          Cada propiedad en Lomas de la Llanada ofrece aproximadamente 5.000 m²,
          desde los ¢13.000 por m2, brindando la amplitud, privacidad y libertad
          que hoy pocas opciones ofrecen en Ciudad Quesada. El proyecto contará
          con calles internas, acceso controlado con portón eléctrico y un
          entorno natural privilegiado, con la tranquilidad de un residencial
          privado pero sin cuotas condominales. Actualmente, se encuentra en
          etapa de preventa, con precios preferenciales y financiamiento directo,
          sin prima, sin fiador y con un trámite sencillo.
        </p>

        <button
          onClick={goToFunnel}
          className="w-full border-2 border-gray-900 text-gray-900 font-semibold text-lg py-4 rounded-2xl hover:bg-gray-900 hover:text-white transition-colors duration-200 mb-10"
        >
          Conozca el proyecto
        </button>

        {/* Back to top */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="mx-auto flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </section>
    </div>
  );
}
