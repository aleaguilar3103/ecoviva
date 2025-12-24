import ProjectCard, { ProjectCardData } from "./ProjectCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProjectShowcaseProps {
  projects?: ProjectCardData[];
}

export default function ProjectShowcase({ projects }: ProjectShowcaseProps) {
  const { t } = useLanguage();

  const defaultProjects: ProjectCardData[] = [
    {
      id: "rio-celeste",
      title: "Río Celeste Oasis",
      location: "Katira, Guatuso · Zona Norte, Alajuela",
      image:
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
      price: "",
      size: "Desde 1.300 m² hasta 5.000 m²",
      features: [
        "Acceso privado y directo al Río Celeste",
        "15 quintas de 5.000 m² + lotes desde 1.300 m²",
        "Seguridad: control de acceso + cámaras",
        "Ranchos BBQ, baños, senderos y deck",
      ],
      badges: ["Disponible", "Acceso privado al río", "Balneario natural"],
      description: t("projects.rioCeleste.description"),
      financingDetails: t("projects.financingDetails") as any,
      gallery: [
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2a1e01a2679ee14be.jpeg",
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291a1efd53d7a3.jpeg",
        "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291af16553d7a1.jpeg",
      ],
    },
    {
      id: "llanada-views",
      title: t("projects.llanadaViews.title"),
      location: t("projects.llanadaViews.location"),
      image: "/images/llanada-1.jpeg",
      price: "",
      size: t("projects.llanadaViews.size"),
      features: t("projects.llanadaViews.features") as any,
      badges: t("projects.llanadaViews.badges") as any,
      description: t("projects.llanadaViews.description"),
      financingDetails: t("projects.financingDetails") as any,
      gallery: [
        "/images/llanada-1.jpeg",
        "/images/llanada-2.jpeg",
        "/images/llanada-3.jpeg",
      ],
    },
  ];

  return (
    <section id="projects" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
            {t("projects.title")}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t("projects.subtitle")}
          </p>
        </div>

        {/* Project Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {(projects || defaultProjects).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
