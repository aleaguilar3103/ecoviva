import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, ChevronLeft, ChevronRight, MapPin, Building, TreePine, Shield, Network, Landmark } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";

export default function LomasLlanadaDetail() {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleContactClick = () => {
    window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");
  };

  const galleryImages = [
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95eb392bad08976b19.png",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95f62bb7268496bdf7.png",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95a87beb359e18dcf7.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95c1fa0c7535d7678f.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95d4fb90fa691c3dfb.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce9529dcf5340895c73a.png",
  ];

  const showcaseVideo = "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977def1c1fa0c8c75dae07d.mp4";

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
    setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const scrollGallery = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      if (direction === 'left') {
        scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="bg-white animate-fadeIn">
      <Header />
      {/* Hero Section with Image */}
      <section className="relative h-[60vh] min-h-[500px] bg-gray-900">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${galleryImages[0]})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>
        
        <div className="relative h-full container mx-auto px-4 lg:px-8 flex items-center">
          <div className="max-w-3xl text-white">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              {t("lomasLlanadaDetail.heroTitle")}
            </h1>
            <p className="text-2xl mb-3 text-white/90">
              {t("lomasLlanadaDetail.heroSubtitle")}
            </p>
            <p className="text-lg mb-8 text-white/80 leading-relaxed">
              {t("lomasLlanadaDetail.heroDescription")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleContactClick}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white px-8"
              >
                {t("lomasLlanadaDetail.requestInfo")}
              </Button>
              <Button
                onClick={() => window.location.href = "/agendar-visita"}
                size="lg"
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                {t("lomasLlanadaDetail.scheduleVisit")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Video Showcase Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                {t("lomasLlanadaDetail.videoTitle")}
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                {t("lomasLlanadaDetail.videoSubtitle")}
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-gray-700">
                  <Check className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
                  {t("lomasLlanadaDetail.videoFeature1")}
                </li>
                <li className="flex items-center text-gray-700">
                  <Check className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
                  {t("lomasLlanadaDetail.videoFeature2")}
                </li>
                <li className="flex items-center text-gray-700">
                  <Check className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
                  {t("lomasLlanadaDetail.videoFeature3")}
                </li>
              </ul>
              <Button
                onClick={handleContactClick}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white"
              >
                {t("lomasLlanadaDetail.requestInfo")}
              </Button>
            </div>
            {/* Video */}
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="rounded-2xl overflow-hidden shadow-2xl max-w-sm">
                <video
                  src={showcaseVideo}
                  controls
                  className="w-full h-auto"
                  poster={galleryImages[0]}
                >
                  Tu navegador no soporta videos HTML5.
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-3">
              {t("lomasLlanadaDetail.galleryTitle")}
            </h2>
            <p className="text-lg text-gray-600">
              {t("lomasLlanadaDetail.gallerySubtitle")}
            </p>
          </div>

          {/* Carousel */}
          <div className="relative max-w-6xl mx-auto">
            {/* Left Arrow */}
            <button
              onClick={() => scrollGallery('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-8 z-10 bg-primary hover:bg-primary/90 text-white p-2 rounded-full transition-all hover:scale-110 shadow-lg"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Gallery Container */}
            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
              style={{ scrollBehavior: 'smooth' }}
            >
              {galleryImages.map((image, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-80 h-64 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all hover:shadow-2xl hover:scale-105"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={`${image}?w=600&q=75`}
                    alt={`Lomas de la Llanada - Imagen ${index + 1}`}
                    className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
                  />
                </div>
              ))}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollGallery('right')}
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

      {/* Content Block 1 - Main Description */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 text-center">
            {t("lomasLlanadaDetail.differentProject")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed text-center">
            {t("lomasLlanadaDetail.differentProjectDesc")}
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("lomasLlanadaDetail.pricingTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Lotes 600m² */}
            <Card className="border-accent/20 hover:shadow-xl transition-shadow overflow-hidden">
              <div className="bg-accent/10 p-4 text-center">
                <span className="bg-accent text-white px-3 py-1 rounded-full text-sm font-medium">
                  {t("lomasLlanadaDetail.startingPrice")}
                </span>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  {t("lomasLlanadaDetail.price600Title")}
                </h3>
                <p className="text-4xl font-bold text-accent mb-2">₡45,000</p>
                <p className="text-gray-600 mb-2">{t("lomasLlanadaDetail.perSquareMeter")}</p>
                <p className="text-2xl font-semibold text-primary mb-4">₡27,000,000</p>
                <p className="text-gray-700">
                  {t("lomasLlanadaDetail.price600Desc")}
                </p>
              </CardContent>
            </Card>

            {/* Lotes 5000m² con vista */}
            <Card className="border-accent/20 hover:shadow-xl transition-shadow overflow-hidden ring-2 ring-accent">
              <div className="bg-accent p-4 text-center">
                <span className="text-white font-bold text-sm">
                  {t("lomasLlanadaDetail.premiumView")}
                </span>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  {t("lomasLlanadaDetail.price5000ViewTitle")}
                </h3>
                <p className="text-4xl font-bold text-accent mb-2">₡17,000</p>
                <p className="text-gray-600 mb-2">{t("lomasLlanadaDetail.perSquareMeter")}</p>
                <p className="text-2xl font-semibold text-primary mb-4">₡85,000,000</p>
                <p className="text-gray-700">
                  {t("lomasLlanadaDetail.price5000ViewDesc")}
                </p>
              </CardContent>
            </Card>

            {/* Lotes 5000m² sin vista */}
            <Card className="border-accent/20 hover:shadow-xl transition-shadow overflow-hidden">
              <div className="bg-primary/10 p-4 text-center">
                <span className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                  {t("lomasLlanadaDetail.bestValue")}
                </span>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  {t("lomasLlanadaDetail.price5000Title")}
                </h3>
                <p className="text-4xl font-bold text-accent mb-2">₡13,000</p>
                <p className="text-gray-600 mb-2">{t("lomasLlanadaDetail.perSquareMeter")}</p>
                <p className="text-2xl font-semibold text-primary mb-4">₡65,000,000</p>
                <p className="text-gray-700">
                  {t("lomasLlanadaDetail.price5000Desc")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Strategic Location Highlight */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl text-center">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-accent" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            {t("lomasLlanadaDetail.strategicLocationTitle")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            {t("lomasLlanadaDetail.strategicLocationDesc")}
          </p>
        </div>
      </section>

      {/* Key Features Grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("lomasLlanadaDetail.keyFeaturesTitle")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: <MapPin className="w-8 h-8" />, titleKey: "feature1Title", descKey: "feature1Desc" },
              { icon: <TreePine className="w-8 h-8" />, titleKey: "feature2Title", descKey: "feature2Desc" },
              { icon: <Shield className="w-8 h-8" />, titleKey: "feature3Title", descKey: "feature3Desc" },
              { icon: <Network className="w-8 h-8" />, titleKey: "feature4Title", descKey: "feature4Desc" },
              { icon: <Landmark className="w-8 h-8" />, titleKey: "feature5Title", descKey: "feature5Desc" },
              { icon: <Building className="w-8 h-8" />, titleKey: "feature6Title", descKey: "feature6Desc" },
            ].map((feature, index) => (
              <Card key={index} className="border-accent/20 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center mb-4 text-accent">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">
                    {t(`lomasLlanadaDetail.${feature.titleKey}`)}
                  </h3>
                  <p className="text-gray-600">
                    {t(`lomasLlanadaDetail.${feature.descKey}`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Image Text Split - Urban Vision */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <img
                src={galleryImages[1]}
                alt="Lomas de la Llanada Vista"
                className="rounded-2xl shadow-lg w-full h-[400px] object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
                {t("lomasLlanadaDetail.urbanVisionTitle")}
              </h2>
              <ul className="space-y-4">
                {[
                  t("lomasLlanadaDetail.urbanVision1"),
                  t("lomasLlanadaDetail.urbanVision2"),
                  t("lomasLlanadaDetail.urbanVision3"),
                  t("lomasLlanadaDetail.urbanVision4"),
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

      {/* Services Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
                {t("lomasLlanadaDetail.servicesTitle")}
              </h2>
              <ul className="space-y-4">
                {[
                  t("lomasLlanadaDetail.service1"),
                  t("lomasLlanadaDetail.service2"),
                  t("lomasLlanadaDetail.service3"),
                  t("lomasLlanadaDetail.service4"),
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
            <div className="order-1 md:order-2">
              <img
                src={galleryImages[2]}
                alt="Ciudad Quesada servicios"
                className="rounded-2xl shadow-lg w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Connectivity Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 text-center">
            {t("lomasLlanadaDetail.connectivityTitle")}
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed text-center">
            {t("lomasLlanadaDetail.connectivityDesc")}
          </p>
        </div>
      </section>

      {/* Target Audience Cards */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-12 text-center">
            {t("lomasLlanadaDetail.targetTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: t("lomasLlanadaDetail.targetFamily"),
                text: t("lomasLlanadaDetail.targetFamilyDesc"),
              },
              {
                title: t("lomasLlanadaDetail.targetInvestor"),
                text: t("lomasLlanadaDetail.targetInvestorDesc"),
              },
              {
                title: t("lomasLlanadaDetail.targetRetiree"),
                text: t("lomasLlanadaDetail.targetRetireeDesc"),
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
            {t("lomasLlanadaDetail.summaryTitle")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              t("lomasLlanadaDetail.summary1"),
              t("lomasLlanadaDetail.summary2"),
              t("lomasLlanadaDetail.summary3"),
              t("lomasLlanadaDetail.summary4"),
              t("lomasLlanadaDetail.summary5"),
              t("lomasLlanadaDetail.summary6"),
              t("lomasLlanadaDetail.summary7"),
              t("lomasLlanadaDetail.summary8"),
            ].map((item, index) => (
              <div key={index} className="flex items-center bg-white p-4 rounded-lg shadow-sm">
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
            {t("lomasLlanadaDetail.ctaTitle")}
          </h2>
          <p className="text-xl text-white/90 mb-10 leading-relaxed">
            {t("lomasLlanadaDetail.ctaDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleContactClick}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white px-8"
            >
              {t("lomasLlanadaDetail.requestInfo")}
            </Button>
            <Button
              onClick={() => window.location.href = "/agendar-visita"}
              size="lg"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              {t("lomasLlanadaDetail.scheduleVisit")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
