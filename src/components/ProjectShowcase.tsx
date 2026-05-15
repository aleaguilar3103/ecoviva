import ProjectCard, { ProjectCardData } from "./ProjectCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useRef, useState } from "react";

interface ProjectShowcaseProps {
  projects?: ProjectCardData[];
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

export default function ProjectShowcase({ projects }: ProjectShowcaseProps) {
  const { t } = useLanguage();
  const { ref, inView } = useInView();

  const defaultProjects: ProjectCardData[] = [
    {
      id: "rio-celeste",
      title: t("projects.rioCeleste.title"),
      location: t("projects.rioCeleste.location"),
      image: "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
      price: t("projects.rioCeleste.price"),
      size: t("projects.rioCeleste.size"),
      features: t("projects.rioCeleste.features") as any,
      badges: t("projects.rioCeleste.badges") as any,
      description: t("projects.rioCeleste.description"),
      financingDetails: t("projects.financingDetails") as any,
      viewDetails: t("projects.rioCeleste.viewDetails"),
      gallery: [
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2a1e01a2679ee14be.jpeg",
      ],
    },
    {
      id: "llanada-views",
      title: t("projects.llanadaViews.title"),
      location: t("projects.llanadaViews.location"),
      image: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95eb392bad08976b19.png",
      price: t("projects.llanadaViews.price"),
      size: t("projects.llanadaViews.size"),
      features: t("projects.llanadaViews.features") as any,
      badges: t("projects.llanadaViews.badges") as any,
      description: t("projects.llanadaViews.description"),
      financingDetails: t("projects.financingDetails") as any,
      viewDetails: t("projects.llanadaViews.viewDetails"),
    },
  ];

  return (
    <section id="projects" style={{ backgroundColor: "#0d1410" }} className="py-24">
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        {/* Header */}
        <div
          className="text-center mb-14 transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)" }}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}
          >
            Nuestros Proyectos
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t("projects.title")}</h2>
          <p className="text-lg text-white/45 max-w-2xl mx-auto">{t("projects.subtitle")}</p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {(projects || defaultProjects).map((project, i) => (
            <div
              key={project.id}
              className="transition-all duration-700"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(32px)",
                transitionDelay: `${i * 120}ms`,
              }}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl max-w-3xl mx-auto transition-all duration-700"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(24px)",
            transitionDelay: "300ms",
          }}
        >
          {[
            { value: "2", label: "Proyectos activos" },
            { value: "+40", label: "Lotes disponibles" },
            { value: "690 m²", label: "Tamaño mínimo" },
            { value: "100%", label: "Financiamiento propio" },
          ].map(({ value, label }, i) => (
            <div
              key={i}
              className="text-center py-7 px-4"
              style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
            >
              <p className="text-2xl font-bold mb-1" style={{ color: "#74CE52" }}>{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
