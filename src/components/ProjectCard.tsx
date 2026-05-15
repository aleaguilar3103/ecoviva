import { useNavigate } from "react-router-dom";
import { MapPin, Check, ArrowRight, Maximize2 } from "lucide-react";

export interface ProjectCardData {
  id: string;
  title: string;
  location: string;
  image: string;
  price: string;
  size: string;
  features: string[];
  badges: string[];
  description?: string;
  financingDetails?: string[];
  gallery?: string[];
  viewDetails?: string;
}

interface ProjectCardProps {
  project: ProjectCardData;
  onLearnMore?: (id: string) => void;
  onScheduleVisit?: (id: string) => void;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const go = () => {
    if (project.id === "rio-celeste") navigate("/rio-celeste-oasis-detalle");
    else if (project.id === "llanada-views") navigate("/lomas-de-la-llanada-detalle");
  };

  return (
    <div
      onClick={go}
      className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-1"
      style={{ backgroundColor: "#111a14", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111a14] via-black/30 to-transparent" />

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {project.badges.map((b, i) => (
            <span
              key={i}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(116,206,82,0.18)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.3)" }}
            >
              {b}
            </span>
          ))}
        </div>

        {/* Price bottom-left */}
        {project.price && (
          <div className="absolute bottom-4 left-4">
            <p className="text-white/50 text-[11px] font-medium mb-0.5 uppercase tracking-wider">Desde</p>
            <p className="text-2xl font-bold text-white">{project.price}</p>
          </div>
        )}

        {/* Size bottom-right */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-white/60 text-sm">
          <Maximize2 className="w-3.5 h-3.5" />
          <span>{project.size}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Title + location */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mb-1.5 leading-tight">{project.title}</h3>
          <div className="flex items-center gap-1.5 text-white/45 text-sm">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#74CE52" }} />
            <span>{project.location}</span>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-white/50 mb-4 line-clamp-2 leading-relaxed">{project.description}</p>
        )}

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {project.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#74CE52" }} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); go(); }}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold transition-all duration-300 group/btn"
          style={{ backgroundColor: "rgba(116,206,82,0.12)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.25)" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#74CE52";
            (e.currentTarget as HTMLElement).style.color = "#0d1a10";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(116,206,82,0.12)";
            (e.currentTarget as HTMLElement).style.color = "#74CE52";
          }}
        >
          {project.viewDetails || "Ver detalles"}
          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
