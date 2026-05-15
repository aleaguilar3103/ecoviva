import { Button } from "@/components/ui/button";
import { DollarSign, FileCheck, BadgeCheck, TrendingUp, Shield, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, useRef } from "react";

const AnimatedCounter = ({ end, duration = 2000, suffix = "", prefix = "" }: {
  end: number; duration?: number; suffix?: string; prefix?: string;
}) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    let t0: number;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const prog = Math.min((t - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 4);
      setCount(Math.floor(ease * end));
      if (prog < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
};

interface FinancingSectionProps {
  onContactClick?: () => void;
}

export default function FinancingSection({
  onContactClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank"),
}: FinancingSectionProps) {
  const { t, language } = useLanguage();
  const [activeCard, setActiveCard] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveCard(p => (p + 1) % 5), 2800);
    return () => clearInterval(id);
  }, []);

  const perks = [
    { Icon: DollarSign, title: t("financing.noPrima"), desc: t("financing.noPrimaDesc") },
    { Icon: FileCheck, title: t("financing.noBanks"), desc: t("financing.noBanksDesc") },
    { Icon: BadgeCheck, title: t("financing.requirements"), desc: t("financing.requirementsDesc") },
  ];

  const rotating = [
    { Icon: TrendingUp, title: language === "es" ? "Tasas Competitivas" : "Competitive Rates", desc: language === "es" ? "Las mejores del mercado" : "Best in the market" },
    { Icon: Shield, title: language === "es" ? "Sin Prima Inicial" : "No Down Payment", desc: language === "es" ? "Empezá hoy mismo" : "Start today" },
    { Icon: CheckCircle, title: language === "es" ? "Sin Fiador" : "No Co-signer", desc: language === "es" ? "Sin garantías adicionales" : "No extra guarantees" },
    { Icon: FileCheck, title: language === "es" ? "Sin Costos Ocultos" : "No Hidden Costs", desc: language === "es" ? "Transparencia total" : "Full transparency" },
    { Icon: BadgeCheck, title: language === "es" ? "A Tu Medida" : "Tailored To You", desc: language === "es" ? "Plazos flexibles" : "Flexible terms" },
  ];

  return (
    <section
      ref={ref}
      id="financing"
      className="relative py-24 overflow-hidden"
      style={{ backgroundColor: "#0a0f0b" }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ backgroundColor: "rgba(116,206,82,0.06)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ backgroundColor: "rgba(45,124,76,0.05)" }} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Counters */}
        <div
          className="max-w-3xl mx-auto mb-16 transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(20px)" }}
        >
          <div
            className="grid grid-cols-3 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            {[
              { counter: <AnimatedCounter end={100} suffix="%" />, label: language === "es" ? "Financiamiento Directo" : "Direct Financing" },
              { counter: <><AnimatedCounter end={0} prefix="$" /></>, label: language === "es" ? "Prima Inicial" : "Down Payment" },
              { counter: <><AnimatedCounter end={15} /><span className="text-xl md:text-2xl ml-1">{language === "es" ? "años" : "yrs"}</span></>, label: language === "es" ? "Plazo Máximo" : "Max Term" },
            ].map(({ counter, label }, i) => (
              <div
                key={i}
                className="text-center py-8 px-4"
                style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
              >
                <div className="text-3xl md:text-5xl font-bold mb-1" style={{ color: "#74CE52" }}>{counter}</div>
                <p className="text-xs text-white/40">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section header */}
        <div
          className="text-center mb-14 transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(20px)", transitionDelay: "100ms" }}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}
          >
            {t("financing.badge")}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t("financing.title")}</h2>
          <p className="text-white/45 max-w-xl mx-auto">{t("financing.subtitle")}</p>
        </div>

        {/* Two-column content */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {/* Left: Perks */}
          <div
            className="space-y-3 transition-all duration-700"
            style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(-24px)", transitionDelay: "200ms" }}
          >
            <p className="text-sm font-semibold text-white/50 mb-5 uppercase tracking-wider">
              {language === "es" ? "Beneficios del Programa" : "Program Benefits"}
            </p>
            {perks.map(({ Icon, title, desc }, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 group cursor-default"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(116,206,82,0.07)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(116,206,82,0.2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105"
                  style={{ backgroundColor: "rgba(116,206,82,0.12)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#74CE52" }} />
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">{title}</h4>
                  <p className="text-sm text-white/45">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Rotating card */}
          <div
            className="transition-all duration-700"
            style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(24px)", transitionDelay: "300ms" }}
          >
            <p className="text-sm font-semibold text-white/50 mb-5 uppercase tracking-wider">
              {language === "es" ? "Las Mejores Condiciones" : "Best Market Conditions"}
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "rgba(116,206,82,0.07)", border: "1px solid rgba(116,206,82,0.15)" }}
            >
              {/* Rotating icon area */}
              <div className="relative h-44 flex items-center justify-center p-8">
                {rotating.map(({ Icon, title, desc }, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-600"
                    style={{ opacity: activeCard === i ? 1 : 0, transform: activeCard === i ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)" }}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(116,206,82,0.15)" }}>
                      <Icon className="w-7 h-7" style={{ color: "#74CE52" }} />
                    </div>
                    <p className="font-bold text-white text-lg">{title}</p>
                    <p className="text-sm text-white/50">{desc}</p>
                  </div>
                ))}
              </div>
              {/* Dots */}
              <div className="flex justify-center gap-1.5 pb-5">
                {rotating.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveCard(i)}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: activeCard === i ? "24px" : "6px", backgroundColor: activeCard === i ? "#74CE52" : "rgba(255,255,255,0.2)" }}
                  />
                ))}
              </div>
            </div>

            {/* Único requisito */}
            <div
              className="mt-4 p-4 rounded-2xl text-center"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs text-white/40 mb-1">{language === "es" ? "Único requisito" : "Only requirement"}</p>
              <p className="font-semibold text-white">{language === "es" ? "Cédula de identidad + llenar formulario" : "ID card + fill out form"}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          className="text-center transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(20px)", transitionDelay: "400ms" }}
        >
          <Button
            onClick={onContactClick}
            size="lg"
            className="font-semibold px-10 py-6 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.03]"
            style={{ backgroundColor: "#74CE52", color: "#0d1a10", fontSize: "1rem" }}
          >
            {t("financing.cta")}
          </Button>
          <p className="text-white/30 text-sm mt-4">{t("financing.ctaSubtext")}</p>
        </div>
      </div>
    </section>
  );
}
