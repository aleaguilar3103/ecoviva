import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Check, MessageCircle } from "lucide-react";
import { ProjectCardData } from "./ProjectCard";

interface PropertyModalProps {
  project: ProjectCardData & {
    description?: string;
    financingDetails?: string[];
    gallery?: string[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PropertyModal({
  project,
  open,
  onOpenChange,
}: PropertyModalProps) {
  const handleContactClick = () => {
    window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");
  };

  const images = project.gallery || [project.image];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-primary">
            {project.title}
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600">
            {project.location}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Gallery */}
          <div className="relative">
            <Carousel className="w-full">
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="relative h-96 rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`${project.title} - ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-4" />
                  <CarouselNext className="right-4" />
                </>
              )}
            </Carousel>
          </div>

          {/* Price and Size */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 mb-1">Precio</p>
              <p className="text-2xl font-bold text-primary">{project.price}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Tamaño</p>
              <p className="text-2xl font-bold text-primary">{project.size}</p>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <h3 className="text-xl font-bold text-primary mb-3">
                Descripción
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          {/* Features */}
          <div>
            <h3 className="text-xl font-bold text-primary mb-3">
              Características
            </h3>
            <div className="space-y-2">
              {project.features.map((feature, index) => (
                <div key={index} className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financing Details */}
          {project.financingDetails && project.financingDetails.length > 0 && (
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-primary mb-3">
                Detalles de Financiamiento
              </h3>
              <div className="space-y-2">
                {project.financingDetails.map((detail, index) => (
                  <div key={index} className="flex items-start">
                    <Check className="w-5 h-5 mr-2 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 font-medium">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact Button */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleContactClick}
              size="lg"
              className="flex-1 bg-accent hover:bg-accent/90 text-white gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Solicitar información
            </Button>
            <Button
              onClick={handleContactClick}
              size="lg"
              variant="outline"
              className="flex-1 border-primary text-primary hover:bg-primary hover:text-white"
            >
              Contactar asesor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
