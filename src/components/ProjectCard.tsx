import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Maximize, Check } from "lucide-react";
import PropertyModal from "./PropertyModal";

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
}

interface ProjectCardProps {
  project: ProjectCardData;
  onLearnMore?: (projectId: string) => void;
  onScheduleVisit?: (projectId: string) => void;
}

export default function ProjectCard({
  project,
  onLearnMore = () => {},
  onScheduleVisit = () => {},
}: ProjectCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <Card
        className="overflow-hidden hover:shadow-2xl transition-all duration-300 group bg-white cursor-pointer"
        onClick={() => setModalOpen(true)}
      >
        {/* Image */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {project.badges.map((badge, index) => (
              <Badge key={index} className="bg-accent text-white border-0">
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <CardContent className="p-6">
          {/* Title & Location */}
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-primary mb-2">
              {project.title}
            </h3>
            <div className="flex items-center text-gray-600">
              <MapPin className="w-4 h-4 mr-1" />
              <span className="text-sm">{project.location}</span>
            </div>
          </div>

          {/* Size */}
          <div className="mb-4">
            <div className="flex items-center text-gray-700 mb-2">
              <Maximize className="w-4 h-4 mr-2 text-accent" />
              <span className="text-sm font-medium">{project.size}</span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-4">
            {project.features.map((feature, index) => (
              <div key={index} className="flex items-start">
                <Check className="w-4 h-4 mr-2 text-accent flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="mb-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Precio</p>
            <p className="text-3xl font-bold text-primary">{project.price}</p>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              Ver detalles
            </Button>
          </div>
        </CardContent>
      </Card>
      <PropertyModal
        project={project}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
