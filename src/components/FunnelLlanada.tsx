import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Mountain,
  Droplets,
  TrendingUp,
  FileCheck,
} from "lucide-react";

// ─── Assets ───────────────────────────────────────────────────────────────────

const LOGO =
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c305d339e3092e1873e357.png";

const IMG = {
  lomas1: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e6b0a70ae03223880.jpg",
  lomas2: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e52ad3bc301da4b5c.jpg",
  strip1: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e350cfe580a318cce.jpg",
  strip2: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e146bc5fcfedf1406.jpg",
  cta:    "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e81e6bc935b6b211c.jpg",
};

const CAROUSEL_IMGS = [
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e6b0a70ae03223880.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e52ad3bc301da4b5c.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e350cfe580a318cce.jpg",
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e146bc5fcfedf1406.jpg",
];

// ─── Benefit items ─────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: Mountain,
    title: "Naturaleza intacta",
    desc: "Lotes rodeados de bosque, ríos y vistas panorámicas que no se pueden replicar.",
  },
  {
    icon: FileCheck,
    title: "Financiamiento directo",
    desc: "Sin prima, sin fiador y con aprobación inmediata. Nosotros financiamos.",
  },
  {
    icon: TrendingUp,
    title: "Plusvalía real",
    desc: "Zonas de alto crecimiento en Costa Rica con valorización comprobada.",
  },
  {
    icon: Droplets,
    title: "Escritura pública",
    desc: "Proceso transparente y seguro. Tu inversión protegida desde el primer día.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FunnelLlanada() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const goToFunnel = () => navigate("/funnel");

  const prev = () => setSlide((s) => (s - 1 + CAROUSEL_IMGS.length) % CAROUSEL_IMGS.length);
  const next = () => setSlide((s) => (s + 1) % CAROUSEL_IMGS.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div className="bg-[#080e08] text-white min-h-screen">

      {/* ── Logo bar ── */}
      <div className="px-6 pt-6 sm:px-10 sm:pt-8">
        <img src={LOGO} alt="Eco Viva Desarrollos" className="h-10 sm:h-12 w-auto" />
      </div>

      {/* ── PROJECT DETAIL (now first section) ── */}
      <section className="pt-10 pb-20 px-5 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-green-400 text-sm font-medium tracking-widest uppercase text-center mb-3">
            Preventa de lotes · Ciudad Quesada
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-center leading-tight tracking-tight mb-3">
            Lomas de la{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
              Llanada
            </span>
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-white/70 text-center mb-4">
            Eco-Comunidad privada en Ciudad Quesada
          </h2>
          <p className="text-white/55 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            Lomas de la Llanada es una eco comunidad privada ubicada en el corazón de Ciudad
            Quesada, diseñada para quienes buscan espacio, privacidad, tranquilidad y una
            inversión con visión a futuro.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Image */}
            <div className="group relative rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] relative">
                <img
                  src={IMG.lomas1}
                  alt="Lomas de la Llanada"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Mountain className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-xs font-semibold tracking-widest uppercase">
                    Ciudad Quesada
                  </span>
                </div>
                <p className="text-white/80 text-sm">Lomas de la Llanada</p>
              </div>
            </div>

            {/* Detail text */}
            <div className="flex flex-col justify-center gap-5 py-2">
              <p className="text-white/70 leading-relaxed">
                Cada propiedad ofrece aproximadamente{" "}
                <span className="text-white font-semibold">5.000 m²</span>, brindando la
                amplitud, privacidad y libertad que hoy pocas opciones ofrecen en Ciudad
                Quesada.
              </p>
              <p className="text-white/70 leading-relaxed">
                El proyecto contará con calles internas, electricidad, agua potable, portón de
                acceso eléctrico y un entorno natural privilegiado, con la tranquilidad de un
                residencial privado pero{" "}
                <span className="text-white font-semibold">sin cuotas condominales</span>.
              </p>
              <p className="text-white/70 leading-relaxed">
                En etapa de preventa, con precios preferenciales y{" "}
                <span className="text-white font-semibold">
                  financiamiento directo, sin prima, sin fiador
                </span>{" "}
                y con trámite sencillo.
              </p>
              <button
                onClick={goToFunnel}
                className="group inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-semibold transition-colors mt-1 w-fit"
              >
                Agendar mi visita
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHOTO CAROUSEL ── */}
      <div className="px-5 sm:px-10 pb-10">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ aspectRatio: "4/3" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={CAROUSEL_IMGS[slide]}
            alt={`Vista ${slide + 1}`}
            className="w-full h-full object-cover"
          />

          {/* Prev arrow */}
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Next arrow */}
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {CAROUSEL_IMGS.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Imagen ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === slide ? "bg-white scale-125" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── IMAGE STRIP ── */}
      <div className="flex h-40 sm:h-56 overflow-hidden">
        {[IMG.lomas2, IMG.strip1, IMG.lomas1, IMG.strip2].map((src, i) => (
          <div key={i} className="flex-1 relative overflow-hidden">
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
        ))}
      </div>

      {/* ── BENEFITS ── */}
      <section className="py-20 px-5 sm:px-10">
        <div className="max-w-4xl mx-auto">
          <p className="text-green-400 text-sm font-medium tracking-widest uppercase text-center mb-3">
            Por qué Eco Viva
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
            Lo que hace diferente esta inversión
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="flex gap-4 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-green-500/30 hover:bg-white/8 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{b.title}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-28 px-5 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${IMG.cta})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <p className="text-green-400 text-sm font-medium tracking-widest uppercase mb-4">
            El siguiente paso es tuyo
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-6">
            ¿Querés saber si este proyecto es para vos?
          </h2>
          <p className="text-white/65 text-base sm:text-lg mb-10 leading-relaxed">
            Respondé unas preguntas rápidas y agendá una visita sin compromiso.
            Un asesor te acompaña en todo el proceso.
          </p>

          <button
            onClick={goToFunnel}
            className="group inline-flex items-center gap-3 bg-green-500 hover:bg-green-400 text-white font-bold text-lg px-10 py-4 rounded-full transition-all duration-300 shadow-xl shadow-black/40 hover:scale-105"
          >
            Comenzar ahora
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          <p className="mt-5 text-white/35 text-sm">
            Sin compromiso · Sin costo · Solo información
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="py-6 px-5 text-center border-t border-white/10">
        <img src={LOGO} alt="Eco Viva" className="h-8 w-auto mx-auto opacity-60" />
        <p className="text-white/30 text-xs mt-2">
          © {new Date().getFullYear()} Eco Viva Desarrollos · Costa Rica
        </p>
      </div>
    </div>
  );
}
