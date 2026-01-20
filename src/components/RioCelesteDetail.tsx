import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";

export default function RioCelesteDetail() {
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
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6949d089b624f90a006172a2.jpg"
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
            backgroundImage: `url(${projectImages[0]})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>
        
        <div className="relative h-full container mx-auto px-4 lg:px-8 flex items-center">
          <div className="max-w-3xl text-white">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              {t("rioCelesteDetail.heroTitle")}
            </h1>
            <p className="text-2xl mb-3 text-white/90">
              {t("rioCelesteDetail.heroSubtitle")}
            </p>
            <p className="text-lg mb-8 text-white/80 leading-relaxed">
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
                onClick={() => window.location.href = "/agendar-visita"}
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
                    alt={`Río Celeste Oasis - Imagen ${index + 1}`}
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
              <Card key={index} className="border-accent/20 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex items-center">
                  <div className="text-4xl mr-4">{feature.icon}</div>
                  <p className="text-gray-700 font-medium">{feature.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Image Text Split - Security */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
                {t("rioCelesteDetail.securityTitle")}
              </h2>
              <ul className="space-y-4">
                {[
                  t("rioCelesteDetail.security1"),
                  t("rioCelesteDetail.security2"),
                  t("rioCelesteDetail.security3"),
                  t("rioCelesteDetail.security4"),
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
                src={projectImages[2]}
                alt="Security and entrance"
                className="rounded-2xl shadow-lg w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

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
              onClick={() => window.location.href = "/agendar-visita"}
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
