import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  FileText,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import FinancingBanner from "@/components/FinancingBanner";
import FinancingSection from "@/components/FinancingSection";

// Data for Oasis Río Celeste lots
const rioCelesteLots = [
  // Lotes pequeños - $45 USD/m²
  { id: 2, size: 1632, pricePerM2: 45, total: 73440, available: true },
  {
    id: 3,
    size: 1300,
    pricePerM2: 45,
    total: 58500,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f6803fc45e31.pdf",
  },
  {
    id: 4,
    size: 1300,
    pricePerM2: 45,
    total: 58500,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b710efd660795e1e98.pdf",
  },
  {
    id: 5,
    size: 1300,
    pricePerM2: 45,
    total: 58500,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7cab0330346a3.pdf",
  },
  // Lotes grandes - $30 USD/m² - 5,000 m²
  { id: 1, size: 5000, pricePerM2: 30, total: 150000, available: false },
  {
    id: 6,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7caf78c03469e.pdf",
  },
  {
    id: 7,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b77675770f0e3e8a77.pdf",
  },
  {
    id: 8,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b718ecce76ce26b5e1.pdf",
  },
  {
    id: 9,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7767577e8b83e8a7d.pdf",
  },
  {
    id: 10,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7f7a87780474e9c07.pdf",
  },
  {
    id: 11,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f65290c45e33.pdf",
  },
  {
    id: 12,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7ca4e510346a7.pdf",
  },
  // Lote 13 especial - 6,000 m²
  { id: 13, size: 6000, pricePerM2: 30, total: 180000, available: false },
  {
    id: 14,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757794463e8a7e.pdf",
  },
  {
    id: 15,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b8f7a87718884e9c0b.pdf",
  },
  {
    id: 16,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b83c458e581bd62b57.pdf",
  },
  {
    id: 17,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf",
  },
  {
    id: 18,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf",
  },
  {
    id: 19,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757707553e8a78.pdf",
  },
  {
    id: 20,
    size: 5000,
    pricePerM2: 30,
    total: 150000,
    available: true,
    planoVisado:
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7ca56f70346a2.pdf",
  },
];

const formatCurrencyUSD = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function RioCelesteDetail() {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedLot, setSelectedLot] = useState<
    (typeof rioCelesteLots)[0] | null
  >(null);

  // Image zoom and pan states
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleContactClick = () => {
    window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");
  };

  // Map zoom and pan functions
  const handleZoomIn = () => {
    setMapZoom((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setMapZoom((prev) => Math.max(prev - 0.5, 1));
    if (mapZoom <= 1.5) {
      setMapPosition({ x: 0, y: 0 });
    }
  };

  const handleResetZoom = () => {
    setMapZoom(1);
    setMapPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mapZoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - mapPosition.x,
        y: e.clientY - mapPosition.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && mapZoom > 1) {
      setMapPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mapZoom > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - mapPosition.x,
        y: e.touches[0].clientY - mapPosition.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && mapZoom > 1 && e.touches.length === 1) {
      setMapPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const projectImages = [
    "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
    "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2a1e01a2679ee14be.jpeg",
    "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291a1efd53d7a3.jpeg",
    "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291af16553d7a1.jpeg",
  ];

  const galleryImages = [
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f883fecf179ff0cb55.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f8eb54328052b38267.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f883fecf8958f0cb58.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f883fecf9209f0cb57.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f883fecf77c5f0cb56.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f8b624f91967606b7c.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f8671d502465db3676.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f8671d50d371db3675.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949c9f859a0a6a81e790787.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089eb54327c7eb48807.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089eb543246ebb48806.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089b624f939506172a3.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d08979fc96d018e380e8.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d08959a0a6eda17a1d22.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d08ab624f9d59f6172a4.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089adf7e4751ccdbe80.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089938f5c1938174c2d.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089ee99d04d65b0d535.jpg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089b624f90a006172a2.jpg",
  ];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = () => {
    setLightboxIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length,
    );
  };

  const scrollGallery = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      if (direction === "left") {
        scrollContainerRef.current.scrollBy({
          left: -scrollAmount,
          behavior: "smooth",
        });
      } else {
        scrollContainerRef.current.scrollBy({
          left: scrollAmount,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <div className="bg-white animate-fadeIn">
      <Header />
      {/* Hero Section with Image */}
      <section className="relative h-screen min-h-[500px] bg-gray-900">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${projectImages[0]})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative h-full container mx-auto px-4 lg:px-8 flex items-center">
          <div className="max-w-3xl text-white">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4">
              {t("rioCelesteDetail.heroTitle")}
            </h1>
            <p className="text-base sm:text-lg md:text-2xl mb-2 md:mb-3 text-white/90">
              {t("rioCelesteDetail.heroSubtitle")}
            </p>
            <p className="text-sm sm:text-base md:text-lg mb-6 md:mb-8 text-white/80 leading-relaxed">
              {t("rioCelesteDetail.heroDescription")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleContactClick}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white px-8"
              >
                {t("rioCelesteDetail.requestInfo")}
              </Button>
              <Button
                onClick={() => (window.location.href = "/agendar-visita")}
                size="lg"
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                {t("rioCelesteDetail.scheduleVisit")}
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* Financing Banner */}
      <FinancingBanner />
      {/* Gallery Section */}
      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-3">
              {t("rioCelesteDetail.galleryTitle")}
            </h2>
            <p className="text-lg text-gray-600">
              {t("rioCelesteDetail.gallerySubtitle")}
            </p>
          </div>

          {/* Carousel */}
          <div className="relative max-w-6xl mx-auto">
            {/* Left Arrow */}
            <button
              onClick={() => scrollGallery("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-8 z-10 bg-primary hover:bg-primary/90 text-white p-2 rounded-full transition-all hover:scale-110 shadow-lg"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Gallery Container */}
            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
              style={{ scrollBehavior: "smooth" }}
            >
              {galleryImages.map((image, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-80 h-64 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all hover:shadow-2xl hover:scale-105"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={`${image}?w=600&q=75`}
                    alt={`Río Celeste Oasis - Imagen ${index + 1}`}
                    className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
                  />
                </div>
              ))}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollGallery("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-8 z-10 bg-primary hover:bg-primary/90 text-white p-2 rounded-full transition-all hover:scale-110 shadow-lg"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>
      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X size={32} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-4 text-white hover:text-gray-300 text-6xl transition-colors"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-4 text-white hover:text-gray-300 text-6xl transition-colors"
          >
            ›
          </button>
          <img
            src={`${galleryImages[lightboxIndex]}?w=1600&q=90`}
            alt={`Imagen ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-white text-lg">
            {lightboxIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}
      {/* Content Block 1 */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 text-center">
            {t("rioCelesteDetail.differentProject")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed text-center">
            {t("rioCelesteDetail.differentProjectDesc")}
          </p>
        </div>
      </section>
      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("rioCelesteDetail.pricingTitle")}
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Lotes Pequeños */}
            <Card className="border-accent/20 hover:shadow-xl transition-shadow overflow-hidden">
              <div className="bg-accent/10 p-4 text-center">
                <span className="bg-accent text-white px-3 py-1 rounded-full text-sm font-medium">
                  {t("rioCelesteDetail.smallLotsStarting")}
                </span>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  {t("rioCelesteDetail.smallLotsTitle")}
                </h3>
                <p className="text-4xl font-bold text-accent mb-2">$45</p>
                <p className="text-gray-600 mb-2">
                  {t("rioCelesteDetail.perSquareMeter")}
                </p>
                <p className="text-2xl font-semibold text-primary">$58,500</p>
              </CardContent>
            </Card>

            {/* Lotes Grandes */}
            <Card className="border-accent/20 hover:shadow-xl transition-shadow overflow-hidden ring-2 ring-accent">
              <div className="bg-accent p-4 text-center">
                <span className="text-white font-bold text-sm">
                  {t("rioCelesteDetail.largeLotsStarting")}
                </span>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  {t("rioCelesteDetail.largeLotsTitle")}
                </h3>
                <p className="text-4xl font-bold text-accent mb-2">$30</p>
                <p className="text-gray-600 mb-2">
                  {t("rioCelesteDetail.perSquareMeter")}
                </p>
                <p className="text-2xl font-semibold text-primary">$150,000</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Image Text Split - Investment Options */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <img
                src={projectImages[1]}
                alt="Aerial or river view"
                className="rounded-2xl shadow-lg w-full h-[400px] object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
                {t("rioCelesteDetail.investmentOptions")}
              </h2>
              <ul className="space-y-4">
                {[
                  t("rioCelesteDetail.investmentOption1"),
                  t("rioCelesteDetail.investmentOption2"),
                  t("rioCelesteDetail.investmentOption3"),
                  t("rioCelesteDetail.investmentOption4"),
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      {/* Highlight Block - River Access */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl text-center">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            {t("rioCelesteDetail.riverAccessTitle")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            {t("rioCelesteDetail.riverAccessDesc")}
          </p>
        </div>
      </section>
      {/* Gallery Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("rioCelesteDetail.naturalResortTitle")}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {projectImages.map((image, index) => (
              <div
                key={index}
                className="rounded-2xl overflow-hidden shadow-lg h-[300px]"
              >
                <img
                  src={image}
                  alt={`Río Celeste Oasis ${index + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Features Grid - Common Areas */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("rioCelesteDetail.commonAreasTitle")}
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: "🍖", text: t("rioCelesteDetail.commonArea1") },
              { icon: "🚿", text: t("rioCelesteDetail.commonArea2") },
              { icon: "🥾", text: t("rioCelesteDetail.commonArea3") },
              { icon: "🧘", text: t("rioCelesteDetail.commonArea4") },
              { icon: "🌿", text: t("rioCelesteDetail.commonArea5") },
            ].map((feature, index) => (
              <Card
                key={index}
                className="border-accent/20 hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6 flex items-center">
                  <div className="text-4xl mr-4">{feature.icon}</div>
                  <p className="text-gray-700 font-medium">{feature.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* Interactive Lot Distribution Section */}
      <section
        id="distribucion-lotes"
        className="py-20 bg-gradient-to-b from-white to-gray-50"
      >
        <div className="container mx-auto px-4 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <span className="inline-block bg-accent text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              {t("rioCelesteDetail.investmentOpportunity")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-3">
              {t("rioCelesteDetail.mapTitle")}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t("rioCelesteDetail.mapSubtitle")}
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8">
              {/* Map Image */}
              <div className="lg:col-span-3">
                <div
                  ref={mapContainerRef}
                  className="relative rounded-2xl overflow-hidden shadow-xl bg-white border border-gray-100"
                  style={{
                    height: "600px",
                    cursor:
                      mapZoom > 1
                        ? isDragging
                          ? "grabbing"
                          : "grab"
                        : "default",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src="https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/697d22228b2c07b909ccfdf0.png"
                    alt="Mapa Oasis Río Celeste - Distribución de Lotes"
                    className="w-full h-full object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${mapZoom}) translate(${mapPosition.x / mapZoom}px, ${mapPosition.y / mapZoom}px)`,
                      transformOrigin: "center center",
                    }}
                    draggable={false}
                  />

                  {/* Zoom Controls */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <Button
                      onClick={handleZoomIn}
                      disabled={mapZoom >= 4}
                      size="sm"
                      className="bg-white hover:bg-gray-100 text-primary border border-gray-300 shadow-lg"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={handleZoomOut}
                      disabled={mapZoom <= 1}
                      size="sm"
                      className="bg-white hover:bg-gray-100 text-primary border border-gray-300 shadow-lg"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={handleResetZoom}
                      disabled={mapZoom === 1}
                      size="sm"
                      className="bg-white hover:bg-gray-100 text-primary border border-gray-300 shadow-lg"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Zoom Level Indicator */}
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                    <span className="text-sm font-medium text-primary">
                      {Math.round(mapZoom * 100)}%
                    </span>
                  </div>

                  {/* Instructions overlay */}
                  {mapZoom > 1 && (
                    <div className="absolute top-4 left-4 bg-accent/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                      <Move className="w-4 h-4" />
                      <span>Arrastra para mover</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-3 text-center">
                  Usa los controles de zoom para ver los detalles. Haz clic en
                  un lote de la lista para ver información.
                </p>
              </div>

              {/* Lot List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-primary p-4">
                    <h3 className="text-xl font-bold text-white">
                      {t("rioCelesteDetail.availableLots")} (
                      {rioCelesteLots.filter((lot) => lot.available).length})
                    </h3>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {rioCelesteLots
                      .sort((a, b) => a.id - b.id)
                      .map((lot) => (
                        <div
                          key={lot.id}
                          onClick={() =>
                            lot.available &&
                            setSelectedLot(
                              selectedLot?.id === lot.id ? null : lot,
                            )
                          }
                          className={`p-4 border-b border-gray-100 transition-all ${
                            lot.available
                              ? "cursor-pointer hover:bg-accent/5"
                              : "opacity-50 cursor-not-allowed bg-gray-50"
                          } ${
                            selectedLot?.id === lot.id
                              ? "bg-accent/10 border-l-4 border-l-accent"
                              : ""
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary text-lg">
                                  Lote {lot.id}
                                </span>
                                {!lot.available && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                    {t("rioCelesteDetail.noAvailable")}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm mt-1">
                                {lot.size.toLocaleString("es-CR")} m²
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-accent">
                                {formatCurrencyUSD(lot.total)}
                              </p>
                              <p className="text-xs text-gray-500">
                                ${lot.pricePerM2}/m²
                              </p>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {selectedLot?.id === lot.id && lot.available && (
                            <div className="mt-4 pt-4 border-t border-gray-200 animate-fadeIn">
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500 mb-1">
                                    Tamaño
                                  </p>
                                  <p className="font-bold text-primary">
                                    {lot.size.toLocaleString("es-CR")} m²
                                  </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500 mb-1">
                                    Precio/m²
                                  </p>
                                  <p className="font-bold text-primary">
                                    ${lot.pricePerM2} USD
                                  </p>
                                </div>
                              </div>
                              <div className="bg-accent/10 rounded-lg p-3 mb-4">
                                <p className="text-xs text-gray-500 mb-1">
                                  Precio Total Aprox.
                                </p>
                                <p className="font-bold text-accent text-xl">
                                  {formatCurrencyUSD(lot.total)}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      "https://api.whatsapp.com/send?phone=50684142111&text=" +
                                        encodeURIComponent(
                                          `Hola, me interesa el Lote ${lot.id} de ${lot.size.toLocaleString("es-CR")} m² en Oasis Río Celeste. Precio aproximado: ${formatCurrencyUSD(lot.total)}`,
                                        ),
                                      "_blank",
                                    );
                                  }}
                                  size="sm"
                                  className="w-full bg-accent hover:bg-accent/90 text-white text-xs"
                                >
                                  <Info className="w-3 h-3 mr-1" />
                                  Solicitar Info
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = "/agendar-visita";
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-primary text-primary hover:bg-primary/5 text-xs"
                                >
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {t("rioCelesteDetail.scheduleVisit")}
                                </Button>
                                {lot.planoVisado && (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(lot.planoVisado, "_blank");
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="w-full border-accent text-accent hover:bg-accent/5 text-xs"
                                  >
                                    <FileText className="w-3 h-3 mr-1" />
                                    {t("rioCelesteDetail.viewPlan")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="max-w-4xl mx-auto mt-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <p className="text-3xl font-bold text-accent">
                  {rioCelesteLots.filter((lot) => lot.available).length}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {t("rioCelesteDetail.lotsAvailable")}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <p className="text-3xl font-bold text-primary">1,300 m²</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t("rioCelesteDetail.minimumSize")}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <p className="text-3xl font-bold text-primary">6,000 m²</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t("rioCelesteDetail.maximumSize")}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <p className="text-3xl font-bold text-accent">$30/m²</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t("rioCelesteDetail.from")}
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer Note */}
          <div className="max-w-3xl mx-auto mt-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-800 text-sm">
                <strong>{t("rioCelesteDetail.priceNote")}</strong>{" "}
                {t("rioCelesteDetail.priceNoteText")}
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Financing Section */}
      <FinancingSection onContactClick={handleContactClick} />
      {/* Location Content Block */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 text-center">
            {t("rioCelesteDetail.locationTitle")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed text-center">
            {t("rioCelesteDetail.locationDesc")}
          </p>
        </div>
      </section>
      {/* Target Audience Cards */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("rioCelesteDetail.targetTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: t("rioCelesteDetail.targetInvestor"),
                text: t("rioCelesteDetail.targetInvestorDesc"),
              },
              {
                title: t("rioCelesteDetail.targetPatrimonial"),
                text: t("rioCelesteDetail.targetPatrimonialDesc"),
              },
              {
                title: t("rioCelesteDetail.targetLifestyle"),
                text: t("rioCelesteDetail.targetLifestyleDesc"),
              },
            ].map((card, index) => (
              <Card
                key={index}
                className="border-accent/20 hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-8 text-center">
                  <h3 className="text-xl font-bold text-primary mb-4">
                    {card.title}
                  </h3>
                  <p className="text-gray-600">{card.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* Summary Block */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("rioCelesteDetail.summaryTitle")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              t("rioCelesteDetail.summary1"),
              t("rioCelesteDetail.summary2"),
              t("rioCelesteDetail.summary3"),
              t("rioCelesteDetail.summary4"),
              t("rioCelesteDetail.summary5"),
              t("rioCelesteDetail.summary6"),
              t("rioCelesteDetail.summary7"),
              t("rioCelesteDetail.summary8"),
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center bg-white p-4 rounded-lg shadow-sm"
              >
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mr-3 flex-shrink-0">
                  <Check className="w-4 h-4 text-accent" />
                </div>
                <span className="text-gray-700 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {t("rioCelesteDetail.ctaTitle")}
          </h2>
          <p className="text-xl text-white/90 mb-10 leading-relaxed">
            {t("rioCelesteDetail.ctaDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleContactClick}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white px-8"
            >
              {t("rioCelesteDetail.requestInfo")}
            </Button>
            <Button
              onClick={() => (window.location.href = "/agendar-visita")}
              size="lg"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              {t("rioCelesteDetail.scheduleVisit")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
