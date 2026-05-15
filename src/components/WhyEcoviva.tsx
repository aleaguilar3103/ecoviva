import { TreePine, ShieldCheck, Banknote, Leaf, Network, Users } from "lucide-react";
import { useRef, useState, useEffect } from "react";

const pillars = [
  {
    Icon: Leaf,
    title: "Eco-comunidades Privadas",
    desc: "Diseñadas para vivir en armonía con la naturaleza. Bosques, ríos y vistas panorámicas como parte de tu vida cotidiana.",
  },
  {
    Icon: Banknote,
    title: "Financiamiento Propio",
    desc: "Sin banco, sin fiador, sin prima. Solo tu cédula y las ganas de invertir. Aprobación inmediata.",
  },
  {
    Icon: ShieldCheck,
    title: "Seguridad Jurídica",
    desc: "Todos los lotes con planos aprobados, escritura pública y servicios básicos garantizados.",
  },
  {
    Icon: Network,
    title: "Infraestructura Completa",
    desc: "Calles, agua potable, electricidad, internet y áreas verdes incluidos desde el primer día.",
  },
  {
    Icon: TreePine,
    title: "Plusvalía Garantizada",
    desc: "Zonas con alto potencial de valorización. Inversión respaldada por el crecimiento de la Zona Norte.",
  },
  {
    Icon: Users,
    title: "Comunidad de Vecinos",
    desc: "Proyectos con reglamento interno y administración. Un entorno seguro y tranquilo para tu familia.",
  },
];

export default function WhyEcoviva() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24 relative overflow-hidden" style={{ backgroundColor: "#0a0f0b" }}>
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(116,206,82,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(116,206,82,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <div
          className="text-center mb-14 transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)" }}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}
          >
            ¿Por qué Ecoviva?
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Más que un lote,<br />
            <span style={{ color: "#74CE52" }}>un estilo de vida</span>
          </h2>
          <p className="text-white/45 max-w-xl mx-auto text-lg">
            Desarrollamos comunidades sostenibles con todo lo que tu familia necesita para crecer.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {pillars.map(({ Icon, title, desc }, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl transition-all duration-700 group cursor-default"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(28px)",
                transitionDelay: `${i * 70}ms`,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "rgba(116,206,82,0.06)";
                el.style.borderColor = "rgba(116,206,82,0.18)";
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "rgba(255,255,255,0.03)";
                el.style.borderColor = "rgba(255,255,255,0.06)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                style={{ backgroundColor: "rgba(116,206,82,0.12)" }}
              >
                <Icon className="w-6 h-6" style={{ color: "#74CE52" }} />
              </div>
              <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
