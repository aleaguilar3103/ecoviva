import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Mountain,
  Droplets,
  TrendingUp,
  FileCheck,
} from "lucide-react";

// ─── Assets ───────────────────────────────────────────────────────────────────

const LOGO =
  "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c305d339e3092e1873e357.png";

const IMG = {
  hero:   "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e146bc515f6df1405.jpg",
  lomas1: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e6b0a70ae03223880.jpg",
  lomas2: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e52ad3bc301da4b5c.jpg",
  oasis1: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e4a4efa87ee0b7f00.jpg",
  oasis2: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e22e1edd33ceea225.jpg",
  strip1: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e350cfe580a318cce.jpg",
  strip2: "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e146bc5fcfedf1406.jpg",
  cta:    "https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c5813e81e6bc935b6b211c.jpg",
};

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
    desc: "Sin prima, sin fiador y con trámite sencillo. Nosotros financiamos.",
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

export default function FunnelStep1() {
  const navigate = useNavigate();
  const projectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const goToFunnel = () => navigate("/funnel");

  const scrollDown = () => {
    projectsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-[#080e08] text-white min-h-screen">

      {/* ── HERO ── */}
      <section className="relative h-screen min-h-[600px] flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${IMG.hero})` }}
        />
        {/* Gradient overlay: dark bottom heavy so text is always legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080e08] via-black/60 to-black/30" />

        {/* Logo */}
        <div className="relative z-10 px-6 pt-6 sm:px-10 sm:pt-8">
          <img src={LOGO} alt="Eco Viva Desarrollos" className="h-10 sm:h-12 w-auto" />
        </div>

        {/* Hero content — vertically centered in remaining space */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5">
          <div className="max-w-3xl">
            <p className="text-sm sm:text-base font-medium text-green-400 tracking-widest uppercase mb-4">
              Costa Rica · Lotes con naturaleza
            </p>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
              Tu próxima inversión{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                tiene montañas.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-white/75 max-w-xl mx-auto mb-10 leading-relaxed">
              Lotes en los rincones más hermosos de Costa Rica, con financiamiento
              directo y sin complicaciones.
            </p>

            <button
              onClick={goToFunnel}
              className="group inline-flex items-center gap-3 bg-green-500 hover:bg-green-400 text-white font-bold text-base sm:text-lg px-8 py-4 rounded-full transition-all duration-300 shadow-lg shadow-green-900/40 hover:shadow-green-500/30 hover:scale-105"
            >
              Descubrí si es para mí
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={scrollDown}
          className="relative z-10 mx-auto mb-8 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
        >
          <span className="text-xs tracking-widest uppercase">Ver proyectos</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </section>

      {/* ── PROJECTS ── */}
      <section ref={projectsRef} className="py-20 px-5 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-green-400 text-sm font-medium tracking-widest uppercase text-center mb-3">
            Nuestros proyectos
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Dos destinos únicos en Costa Rica
          </h2>
          <p className="text-white/55 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            Seleccionamos zonas de alto potencial donde la naturaleza y la
            inversión van de la mano.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Lomas de la Llanada */}
            <div className="group relative rounded-2xl overflow-hidden cursor-pointer" onClick={goToFunnel}>
              <div className="aspect-[4/3] relative">
                <img
                  src={IMG.lomas1}
                  alt="Lomas de la Llanada"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Mountain className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-xs font-semibold tracking-widest uppercase">
                    Ciudad Quesada
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">Lomas de la Llanada</h3>
                <p className="text-white/70 text-sm leading-snug">
                  Fincas y lotes en las montañas de la región norte. Clima
                  fresco, vistas impresionantes y acceso a servicios.
                </p>
              </div>
              <div className="absolute top-4 right-4 bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                Disponible
              </div>
            </div>

            {/* Oasis Río Celeste */}
            <div className="group relative rounded-2xl overflow-hidden cursor-pointer" onClick={goToFunnel}>
              <div className="aspect-[4/3] relative">
                <img
                  src={IMG.oasis1}
                  alt="Oasis Río Celeste"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-xs font-semibold tracking-widest uppercase">
                    Río Celeste
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">Oasis Río Celeste</h3>
                <p className="text-white/70 text-sm leading-snug">
                  Lotes junto al río turquesa más famoso de Costa Rica. Naturaleza
                  única, plusvalía turística garantizada.
                </p>
              </div>
              <div className="absolute top-4 right-4 bg-cyan-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                Disponible
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── IMAGE STRIP ── */}
      <div className="flex h-40 sm:h-56 overflow-hidden">
        {[IMG.lomas2, IMG.strip1, IMG.oasis2, IMG.strip2].map((src, i) => (
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
        {/* Background image */}
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

      {/* Footer strip */}
      <div className="py-6 px-5 text-center border-t border-white/10">
        <img src={LOGO} alt="Eco Viva" className="h-8 w-auto mx-auto opacity-60" />
        <p className="text-white/30 text-xs mt-2">
          © {new Date().getFullYear()} Eco Viva Desarrollos · Costa Rica
        </p>
      </div>
    </div>
  );
}
