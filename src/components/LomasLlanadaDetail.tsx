import { Check, X, ChevronLeft, ChevronRight, MapPin, Building, TreePine, Shield, Network, Landmark, Info, Calendar, FileDown, MessageCircle, ArrowDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import FinancingSection from "@/components/FinancingSection";
import LotMapInteractive from "@/components/LotMapInteractive";

const bloque1Lots = [
  { id: 1, size: 1300, pricePerM2: 45000, total: 58500000, status: "not_available" as const },
  { id: 2, size: 1300, pricePerM2: 45000, total: 58500000, status: "not_available" as const },
  { id: 3, size: 1404, pricePerM2: 45000, total: 63180000, status: "not_available" as const },
  { id: 4, size: 696, pricePerM2: 45000, total: 31320000, status: "not_available" as const },
  { id: 5, size: 690, pricePerM2: 45000, total: 31050000, status: "not_available" as const },
  { id: 6, size: 690, pricePerM2: 45000, total: 31050000, status: "not_available" as const },
  { id: 7, size: 690, pricePerM2: 45000, total: 31050000, status: "not_available" as const },
  { id: 8, size: 690, pricePerM2: 45000, total: 31050000, status: "not_available" as const },
  { id: 12, size: 1987, pricePerM2: 27000, total: 53650000, status: "not_available" as const },
  { id: 13, size: 6947, pricePerM2: 15000, total: 104205000, status: "available" as const },
  { id: 14, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 15, size: 5400, pricePerM2: 17000, total: 91800000, status: "available" as const },
  { id: 16, size: 6009, pricePerM2: 17000, total: 102153000, status: "reserved" as const },
  { id: 17, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 18, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 19, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 20, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 21, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 22, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 23, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 24, size: 5000, pricePerM2: 17000, total: 85000000, status: "sold" as const },
  { id: 25, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 26, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 27, size: 5179, pricePerM2: 17000, total: 88000000, status: "available" as const },
  { id: 28, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 29, size: 5300, pricePerM2: 17000, total: 90000000, status: "sold" as const },
  { id: 30, size: 5265, pricePerM2: 17000, total: 89500000, status: "available" as const },
  { id: 31, size: 7533, pricePerM2: 13275, total: 100000000, status: "available" as const },
  { id: 32, size: 6542, pricePerM2: 13000, total: 85000000, status: "available" as const },
  { id: 33, size: 8141, pricePerM2: 13000, total: 105800000, status: "available" as const },
  { id: 34, size: 5000, pricePerM2: 17000, total: 85000000, status: "reserved" as const },
  { id: 35, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 36, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 37, size: 5000, pricePerM2: 17000, total: 85000000, status: "available" as const },
  { id: 38, size: 5520, pricePerM2: 17000, total: 93850000, status: "sold" as const },
  { id: 39, size: 5416, pricePerM2: 17000, total: 92072000, status: "available" as const },
  { id: 40, size: 5416, pricePerM2: 17000, total: 92072000, status: "available" as const },
];

const getStatusLabel = (status: string) => {
  switch (status) {
    case "sold": return "Vendido";
    case "reserved": return "Reservado";
    case "not_available": return "No disponible";
    default: return "Disponible";
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case "sold": return { backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" };
    case "reserved": return { backgroundColor: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" };
    case "not_available": return { backgroundColor: "rgba(100,116,139,0.12)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(100,116,139,0.2)" };
    default: return { backgroundColor: "rgba(116,206,82,0.12)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.25)" };
  }
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

export default function LomasLlanadaDetail() {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedLot, setSelectedLot] = useState<typeof bloque1Lots[0] | null>(null);
  const [heroZoomed, setHeroZoomed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lotListRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const [mapPanelHeight, setMapPanelHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = setTimeout(() => setHeroZoomed(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = mapPanelRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setMapPanelHeight(entries[0].borderBoxSize[0].blockSize);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleContactClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");

  const galleryImages = [
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95eb392bad08976b19.png",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95f62bb7268496bdf7.png",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95a87beb359e18dcf7.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95c1fa0c7535d7678f.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95d4fb90fa691c3dfb.jpeg",
    "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce9529dcf5340895c73a.png",
  ];

  const showcaseVideo = "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977def1c1fa0c8c75dae07d.mp4";

  const scrollGallery = (dir: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  const handleLotSelectFromMap = (lot: typeof bloque1Lots[0] | null) => {
    setSelectedLot(lot);
    if (lot && lotListRef.current) {
      const el = lotListRef.current.querySelector(`[data-lot-id="${lot.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const features = [
    { Icon: MapPin, title: t("lomasLlanadaDetail.feature1Title"), desc: t("lomasLlanadaDetail.feature1Desc") },
    { Icon: TreePine, title: t("lomasLlanadaDetail.feature2Title"), desc: t("lomasLlanadaDetail.feature2Desc") },
    { Icon: Shield, title: t("lomasLlanadaDetail.feature3Title"), desc: t("lomasLlanadaDetail.feature3Desc") },
    { Icon: Network, title: t("lomasLlanadaDetail.feature4Title"), desc: t("lomasLlanadaDetail.feature4Desc") },
    { Icon: Landmark, title: t("lomasLlanadaDetail.feature5Title"), desc: t("lomasLlanadaDetail.feature5Desc") },
    { Icon: Building, title: t("lomasLlanadaDetail.feature6Title"), desc: t("lomasLlanadaDetail.feature6Desc") },
  ];

  return (
    <div style={{ backgroundColor: "#0d1410", minHeight: "100vh" }}>
      <Header />

      {/* Hero */}
      <section className="relative flex flex-col overflow-hidden" style={{ height: "100vh", minHeight: "680px" }}>
        {/* Background with Ken Burns */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${galleryImages[0]})`,
              transform: heroZoomed ? "scale(1)" : "scale(1.08)",
              transition: "transform 14s linear",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/38" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 72% 45%, transparent 35%, rgba(0,0,0,0.45) 100%)" }} />
        </div>

        {/* Content */}
        <div className="relative flex-1 flex items-end" style={{ zIndex: 2, paddingBottom: "80px", paddingTop: "120px" }}>
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl">
              <div
                className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide"
                style={{ borderColor: "rgba(116,206,82,0.4)", backgroundColor: "rgba(116,206,82,0.08)", color: "#74CE52" }}
              >
                <MapPin className="w-3 h-3" /> Ciudad Quesada, San Carlos
              </div>

              <h1
                className="font-bold text-white leading-[1.05] mb-4"
                style={{ fontSize: "clamp(2.2rem, 5.5vw, 4rem)" }}
              >
                {t("lomasLlanadaDetail.heroTitle")}
              </h1>

              <p className="text-white/70 text-base md:text-lg mb-6 max-w-xl leading-relaxed">
                {t("lomasLlanadaDetail.heroDescription")}
              </p>

              {/* Stats pills */}
              <div className="flex flex-wrap gap-2 mb-7">
                {[
                  { value: `${bloque1Lots.filter(l => l.status === "available").length}`, label: "lotes disponibles" },
                  { value: "690 – 8,141 m²", label: "tamaño" },
                  { value: "₡0", label: "prima inicial" },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="px-4 py-2 rounded-xl backdrop-blur-sm"
                    style={{ backgroundColor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <span className="font-bold text-white text-sm">{value}</span>
                    <span className="text-white/45 text-xs ml-1.5">{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleContactClick}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03]"
                  style={{ backgroundColor: "#74CE52", color: "#0d1a10" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("lomasLlanadaDetail.requestInfo")}
                </button>
                <button
                  onClick={() => window.location.href = "/agendar-visita"}
                  className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/10"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {t("lomasLlanadaDetail.scheduleVisit")}
                </button>
                <button
                  onClick={() => window.open("https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6992aab1a9efde116d93226d.pdf", "_blank")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/10"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  <FileDown className="w-4 h-4" />
                  {t("lomasLlanadaDetail.downloadInfo")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style={{ zIndex: 3 }}>
          <ArrowDown className="w-4 h-4 text-white/35" />
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ backgroundColor: "#080d09", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {[
              { value: `${bloque1Lots.filter(l => l.status === "available").length}`, label: "Lotes disponibles" },
              { value: "690 m²", label: "Tamaño mínimo" },
              { value: "8,141 m²", label: "Tamaño máximo" },
              { value: "₡13K/m²", label: "Desde" },
            ].map(({ value, label }, i) => (
              <div key={i} className="py-5 px-6 text-center" style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                <div className="text-xl font-bold" style={{ color: "#74CE52" }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video + Description */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 lg:order-1">
              <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-4 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>
                El proyecto
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t("lomasLlanadaDetail.videoTitle")}</h2>
              <p className="text-base mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t("lomasLlanadaDetail.videoSubtitle")}</p>
              <ul className="space-y-3 mb-8">
                {[
                  t("lomasLlanadaDetail.videoFeature1"),
                  t("lomasLlanadaDetail.videoFeature2"),
                  t("lomasLlanadaDetail.videoFeature3"),
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(116,206,82,0.15)" }}>
                      <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={handleContactClick} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]" style={{ backgroundColor: "#74CE52" }}>
                <MessageCircle className="w-4 h-4" />
                {t("lomasLlanadaDetail.requestInfo")}
              </button>
            </div>
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <video src={showcaseVideo} controls className="w-full h-auto" poster={galleryImages[0]} playsInline>
                  Tu navegador no soporta videos HTML5.
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>
              Galería
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("lomasLlanadaDetail.galleryTitle")}</h2>
            <p style={{ color: "rgba(255,255,255,0.45)" }}>{t("lomasLlanadaDetail.gallerySubtitle")}</p>
          </div>
          <div className="relative max-w-6xl mx-auto">
            <button onClick={() => scrollGallery("left")} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110" style={{ backgroundColor: "#080d09", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
              <ChevronLeft size={18} />
            </button>
            <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto pb-3" style={{ scrollBehavior: "smooth", scrollbarWidth: "none" }}>
              {galleryImages.map((img, i) => (
                <div key={i} className="flex-shrink-0 w-72 h-52 rounded-xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.03]" style={{ border: "1px solid rgba(255,255,255,0.06)" }} onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
                  <img src={img} alt={`Lomas de la Llanada ${i + 1}`} className="w-full h-full object-cover brightness-90 group-hover:brightness-110 transition-all duration-300" />
                </div>
              ))}
            </div>
            <button onClick={() => scrollGallery("right")} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110" style={{ backgroundColor: "#080d09", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.96)" }} onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors"><X size={28} /></button>
          <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(p => (p - 1 + galleryImages.length) % galleryImages.length); }} className="absolute left-4 text-white/60 hover:text-white text-5xl">‹</button>
          <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(p => (p + 1) % galleryImages.length); }} className="absolute right-4 text-white/60 hover:text-white text-5xl">›</button>
          <img src={galleryImages[lightboxIndex]} alt={`Imagen ${lightboxIndex + 1}`} className="max-w-[88vw] max-h-[88vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{lightboxIndex + 1} / {galleryImages.length}</div>
        </div>
      )}

      {/* About the project */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">{t("lomasLlanadaDetail.differentProject")}</h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t("lomasLlanadaDetail.differentProjectDesc")}</p>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>
              Precios
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">{t("lomasLlanadaDetail.pricingTitle")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { badge: t("lomasLlanadaDetail.startingPrice"), title: t("lomasLlanadaDetail.price600Title"), perM2: "₡45,000", total: "₡27,000,000", desc: t("lomasLlanadaDetail.price600Desc"), highlight: false },
              { badge: t("lomasLlanadaDetail.premiumView"), title: t("lomasLlanadaDetail.price5000ViewTitle"), perM2: "₡17,000", total: "₡85,000,000", desc: t("lomasLlanadaDetail.price5000ViewDesc"), highlight: true },
              { badge: t("lomasLlanadaDetail.bestValue"), title: t("lomasLlanadaDetail.price5000Title"), perM2: "₡13,000", total: "₡65,000,000", desc: t("lomasLlanadaDetail.price5000Desc"), highlight: false },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: card.highlight ? "1px solid rgba(116,206,82,0.4)" : "1px solid rgba(255,255,255,0.07)" }}>
                <div className="py-3 text-center text-xs font-semibold" style={{ backgroundColor: card.highlight ? "rgba(116,206,82,0.15)" : "rgba(255,255,255,0.04)", color: card.highlight ? "#74CE52" : "rgba(255,255,255,0.5)" }}>
                  {card.badge}
                </div>
                <div className="p-7 text-center">
                  <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
                  <p className="text-3xl font-bold mb-1" style={{ color: "#74CE52" }}>{card.perM2}</p>
                  <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{t("lomasLlanadaDetail.perSquareMeter")}</p>
                  <p className="text-xl font-semibold text-white mb-4">{card.total}</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Lot Map */}
      <section id="bloque1" className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.12)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.25)" }}>
              Preventa Disponible
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Bloque 1 – Distribución de lotes</h2>
            <p style={{ color: "rgba(255,255,255,0.45)" }}>Selecciona un lote en el mapa o en la lista para ver más detalles</p>
          </div>

          <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-6">
            {/* Map */}
            <div className="lg:col-span-3">
              <div ref={mapPanelRef} className="rounded-2xl p-4 pb-3" style={{ backgroundColor: "#0a0f0b", border: "1px solid rgba(255,255,255,0.07)" }}>
                <LotMapInteractive lots={bloque1Lots} selectedLot={selectedLot} onLotSelect={handleLotSelectFromMap} />
                <p className="text-xs mt-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Pasa el cursor sobre un lote · Haz clic para seleccionar
                </p>
              </div>
            </div>

            {/* Lot list */}
            <div className="lg:col-span-2 flex flex-col" style={mapPanelHeight ? { maxHeight: mapPanelHeight } : undefined}>
              <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-5 py-4 flex-shrink-0" style={{ backgroundColor: "#080d09", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <h3 className="font-bold text-white">
                    Lotes disponibles <span style={{ color: "#74CE52" }}>({bloque1Lots.filter(l => l.status === "available").length})</span>
                  </h3>
                </div>
                <div ref={lotListRef} className="overflow-y-auto flex-1 min-h-0" style={{ backgroundColor: "#0a0f0b" }}>
                  {bloque1Lots.map((lot) => {
                    const isSelected = selectedLot?.id === lot.id;
                    return (
                      <div
                        key={lot.id}
                        data-lot-id={lot.id}
                        onClick={() => lot.status === "available" ? setSelectedLot(isSelected ? null : lot) : undefined}
                        className="px-5 py-4 transition-all"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: lot.status === "available" ? "pointer" : "default",
                          backgroundColor: isSelected ? "rgba(116,206,82,0.08)" : "transparent",
                          borderLeft: isSelected ? "3px solid #74CE52" : "3px solid transparent",
                          opacity: lot.status === "not_available" ? 0.45 : 1,
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">Lote {lot.id}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={getStatusStyle(lot.status)}>
                                {getStatusLabel(lot.status)}
                              </span>
                            </div>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{lot.size.toLocaleString("es-CR")} m²</p>
                          </div>
                          {lot.status === "available" && (
                            <div className="text-right">
                              <p className="font-bold text-sm" style={{ color: "#74CE52" }}>{formatCurrency(lot.total)}</p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{formatCurrency(lot.pricePerM2)}/m²</p>
                            </div>
                          )}
                        </div>

                        {isSelected && lot.status === "available" && (
                          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Tamaño</p>
                                <p className="font-bold text-white text-sm">{lot.size.toLocaleString("es-CR")} m²</p>
                              </div>
                              <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Precio/m²</p>
                                <p className="font-bold text-white text-sm">{formatCurrency(lot.pricePerM2)}</p>
                              </div>
                            </div>
                            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "rgba(116,206,82,0.08)", border: "1px solid rgba(116,206,82,0.18)" }}>
                              <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Precio total</p>
                              <p className="font-bold text-lg" style={{ color: "#74CE52" }}>{formatCurrency(lot.total)}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); window.open(`https://api.whatsapp.com/send?phone=50684142111&text=${encodeURIComponent(`Hola, me interesa el Lote ${lot.id} de ${lot.size.toLocaleString("es-CR")} m² en Lomas de la Llanada. Precio: ${formatCurrency(lot.total)}`)}`, "_blank"); }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                                style={{ backgroundColor: "#74CE52" }}
                              >
                                <Info className="w-3 h-3" /> Solicitar Info
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); window.location.href = "/agendar-visita"; }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/10"
                                style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}
                              >
                                <Calendar className="w-3 h-3" /> Agendar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Small lots section */}
      <section className="py-16" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(116,206,82,0.18)" }}>
            <div className="px-8 py-6" style={{ backgroundColor: "rgba(116,206,82,0.06)", borderBottom: "1px solid rgba(116,206,82,0.15)" }}>
              <h2 className="text-2xl md:text-3xl font-bold text-white">{t("lomasLlanadaDetail.smallLotsTitle")}</h2>
            </div>
            <div className="p-8" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                  <p className="text-base leading-relaxed mb-7" style={{ color: "rgba(255,255,255,0.6)" }}>{t("lomasLlanadaDetail.smallLotsDesc")}</p>
                  <div className="grid sm:grid-cols-2 gap-2.5 mb-8">
                    {[
                      t("lomasLlanadaDetail.smallLotsFeature1"),
                      t("lomasLlanadaDetail.smallLotsFeature2"),
                      t("lomasLlanadaDetail.smallLotsFeature3"),
                      t("lomasLlanadaDetail.smallLotsFeature4"),
                      t("lomasLlanadaDetail.smallLotsFeature5"),
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(116,206,82,0.06)", border: "1px solid rgba(116,206,82,0.12)" }}>
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#74CE52" }} />
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a
                    href="https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69a38db5167da40c2a8967b1.pdf"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: "#74CE52" }}
                  >
                    <FileDown className="w-4 h-4" />
                    {t("lomasLlanadaDetail.smallLotsDownload")}
                  </a>
                </div>
                <div className="lg:w-80 flex-shrink-0">
                  <img
                    src="https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69a39268753f157bbe49458c.png"
                    alt="Small lots map"
                    className="w-full object-contain rounded-xl"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financing */}
      <FinancingSection onContactClick={handleContactClick} />

      {/* Location highlight */}
      <section className="py-20 text-center" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(116,206,82,0.12)" }}>
            <MapPin className="w-8 h-8" style={{ color: "#74CE52" }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t("lomasLlanadaDetail.strategicLocationTitle")}</h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{t("lomasLlanadaDetail.strategicLocationDesc")}</p>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t("lomasLlanadaDetail.keyFeaturesTitle")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map(({ Icon, title, desc }, i) => (
              <div key={i} className="p-6 rounded-2xl transition-all hover:-translate-y-1" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(116,206,82,0.12)" }}>
                  <Icon className="w-5 h-5" style={{ color: "#74CE52" }} />
                </div>
                <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image + text split */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <img src={galleryImages[1]} alt="Lomas de la Llanada Vista" className="rounded-2xl shadow-lg w-full h-80 object-cover" style={{ border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t("lomasLlanadaDetail.urbanVisionTitle")}</h2>
              <ul className="space-y-4">
                {[t("lomasLlanadaDetail.urbanVision1"), t("lomasLlanadaDetail.urbanVision2"), t("lomasLlanadaDetail.urbanVision3"), t("lomasLlanadaDetail.urbanVision4")].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(116,206,82,0.15)" }}>
                      <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                    </div>
                    <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t("lomasLlanadaDetail.servicesTitle")}</h2>
              <ul className="space-y-4">
                {[t("lomasLlanadaDetail.service1"), t("lomasLlanadaDetail.service2"), t("lomasLlanadaDetail.service3"), t("lomasLlanadaDetail.service4")].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(116,206,82,0.15)" }}>
                      <Check className="w-3 h-3" style={{ color: "#74CE52" }} />
                    </div>
                    <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <img src={galleryImages[2]} alt="Ciudad Quesada servicios" className="rounded-2xl shadow-lg w-full h-80 object-cover" style={{ border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Target audience */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t("lomasLlanadaDetail.targetTitle")}</h2>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { title: t("lomasLlanadaDetail.targetFamily"), text: t("lomasLlanadaDetail.targetFamilyDesc") },
              { title: t("lomasLlanadaDetail.targetInvestor"), text: t("lomasLlanadaDetail.targetInvestorDesc") },
              { title: t("lomasLlanadaDetail.targetRetiree"), text: t("lomasLlanadaDetail.targetRetireeDesc") },
            ].map((card, i) => (
              <div key={i} className="p-7 rounded-2xl text-center transition-all hover:-translate-y-1" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 text-center">{t("lomasLlanadaDetail.summaryTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {[
              t("lomasLlanadaDetail.summary1"), t("lomasLlanadaDetail.summary2"),
              t("lomasLlanadaDetail.summary3"), t("lomasLlanadaDetail.summary4"),
              t("lomasLlanadaDetail.summary5"), t("lomasLlanadaDetail.summary6"),
              t("lomasLlanadaDetail.summary7"), t("lomasLlanadaDetail.summary8"),
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#74CE52" }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden" style={{ backgroundColor: "#080d09" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(116,206,82,0.07) 0%, transparent 65%)" }} />
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t("lomasLlanadaDetail.ctaTitle")}</h2>
          <p className="text-lg mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t("lomasLlanadaDetail.ctaDesc")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={handleContactClick} className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.03]" style={{ backgroundColor: "#74CE52" }}>
              <MessageCircle className="w-4 h-4" />
              {t("lomasLlanadaDetail.requestInfo")}
            </button>
            <button onClick={() => window.location.href = "/agendar-visita"} className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all hover:bg-white/12" style={{ color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.18)" }}>
              {t("lomasLlanadaDetail.scheduleVisit")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
