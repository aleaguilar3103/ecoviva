import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export interface ProjectDetailData {
  id: string;
  title: string;
  description: string;
  images: string[];
  highlights: string[];
  ctaText?: string;
}

interface ProjectDetailSectionProps {
  project: ProjectDetailData;
  reverse?: boolean;
  onCTAClick?: (projectId: string) => void;
}

export default function ProjectDetailSection({ 
  project,
  reverse = false,
  onCTAClick = () => window.open('https://api.whatsapp.com/send?phone=50684142111', '_blank')
}: ProjectDetailSectionProps) {
  return (
    <section id={`project-${project.id}`} className="py-20 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className={`grid md:grid-cols-2 gap-12 items-center ${reverse ? 'md:flex-row-reverse' : ''}`}>
          {/* Images Gallery */}
          <div className={`${reverse ? 'md:order-2' : ''}`}>
            <div className="grid grid-cols-2 gap-4">
              {project.images.map((image, index) => (
                <div 
                  key={index} 
                  className={`relative rounded-2xl overflow-hidden shadow-xl ${index === 0 ? 'col-span-2 h-96' : 'h-48'}`}
                >
                  <img 
                    src={image}
                    alt={`${project.title} - ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className={`${reverse ? 'md:order-1' : ''}`}>
            <h2 className="text-4xl font-bold text-primary mb-6">
              {project.title}
            </h2>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              {project.description}
            </p>

            {/* Highlights */}
            <div className="space-y-4 mb-8">
              {project.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mr-3 mt-1">
                    <Check className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-gray-700">{highlight}</p>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => onCTAClick(project.id)}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white"
              >
                {project.ctaText || "Quiero detalles"}
              </Button>
              <Button 
                onClick={() => onCTAClick(project.id)}
                size="lg"
                variant="outline"
                className="border-accent text-accent hover:bg-accent hover:text-white"
              >
                Agendar visita
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}