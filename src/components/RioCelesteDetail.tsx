import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  FileText,
  MapPin,
  MessageCircle,
  ArrowDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import FinancingSection from "@/components/FinancingSection";
import RioCelesteMapInteractive, { type RioCelesteLotData } from "@/components/RioCelesteMapInteractive";

const rioCelesteLots = [
  { id: 2, size: 1706.44, pricePerM2: 45, total: Math.round(1706.44 * 45), available: true },
  { id: 3, size: 1620.26, pricePerM2: 45, total: Math.round(1620.26 * 45), available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f6803fc45e31.pdf" },
  { id: 4, size: 1935.31, pricePerM2: 45, total: Math.round(1935.31 * 45), available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b710efd660795e1e98.pdf" },
  { id: 1, size: 5000, pricePerM2: 30, total: 150000, available: false },
  { id: 5, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7cab0330346a3.pdf" },
  { id: 6, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7caf78c03469e.pdf" },
  { id: 7, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b77675770f0e3e8a77.pdf" },
  { id: 8, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b718ecce76ce26b5e1.pdf" },
  { id: 9, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7767577e8b83e8a7d.pdf" },
  { id: 10, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7f7a87780474e9c07.pdf" },
  { id: 11, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f65290c45e33.pdf" },
  { id: 12, size: 6000, pricePerM2: 30, total: 180000, available: false },
  { id: 13, size: 5000, pricePerM2: 30, total: 150000, available: true },
  { id: 14, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757794463e8a7e.pdf" },
  { id: 15, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b8f7a87718884e9c0b.pdf" },
  { id: 16, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b83c458e581bd62b57.pdf" },
  { id: 17, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf" },
  { id: 18, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf" },
  { id: 19, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757707553e8a78.pdf" },
  { id: 20, size: 5000, pricePerM2: 30, total: 150000, available: true, planoVisado: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7ca56f70346a2.pdf" },
];

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function RioCelesteDetail() {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedLot, setSelectedLot] = useState<RioCelesteLotData | null>(null);
  const [heroZoomed, setHeroZoomed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lotListRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const [mapPanelHeight, setMapPanelHeight] = useState<number | undefined>(undefined);

  // Disponibilidad VIVA desde Supabase (panel admin = fuente de verdad).
  // Arranca con los datos locales como respaldo; si el fetch falla, el sitio nunca se rompe.
  const [lots, setLots] = useState<RioCelesteLotData[]>(rioCelesteLots);
  useEffect(() => {
    let active = true;
    fetch("/api/lots?project=rio_celeste")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { lots: any[] }) => {
        if (!active || !Array.isArray(data?.lots) || !data.lots.length) return;
        const mapped = data.lots
          .slice()
          .sort((a, b) => a.lot_number - b.lot_number)
          .map((l) => ({
            id: l.lot_number,
            size: Number(l.size_m2),
            pricePerM2: Number(l.price_per_m2),
            total: Number(l.price_total),
            available: l.status === "available",
            ...(l.plano_visado_url ? { planoVisado: l.plano_visado_url } : {}),
          }));
        setLots(mapped as RioCelesteLotData[]);
      })
      .catch(() => {/* respaldo: datos locales */});
    return () => {
      active = false;
    };
  }, []);

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

  const scrollGallery = (dir: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

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
              backgroundImage: `url(${projectImages[0]})`,
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
                <MapPin className="w-3 h-3" /> Upala, Alajuela
              </div>

              <h1
                className="font-bold text-white leading-[1.05] mb-4"
                style={{ fontSize: "clamp(2.2rem, 5.5vw, 4rem)" }}
              >
                {t("rioCelesteDetail.heroTitle")}
              </h1>

              <p className="text-white/70 text-base md:text-lg mb-6 max-w-xl leading-relaxed">
                {t("rioCelesteDetail.heroDescription")}
              </p>

              {/* Stats pills */}
              <div className="flex flex-wrap gap-2 mb-7">
                {[
                  { value: `${lots.filter(l => l.available).length}`, label: "lotes disponibles" },
                  { value: "1,700 – 6,000 m²", label: "tamaño" },
                  { value: "$0", label: "down payment" },
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
                  {t("rioCelesteDetail.requestInfo")}
                </button>
                <button
                  onClick={() => window.location.href = "/agendar-visita"}
                  className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/10"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {t("rioCelesteDetail.scheduleVisit")}
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
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: `${lots.filter(l => l.available).length}`, label: "Lotes disponibles" },
              { value: "1,300 m²", label: "Tamaño mínimo" },
              { value: "6,000 m²", label: "Tamaño máximo" },
              { value: "$30/m²", label: "Desde" },
            ].map(({ value, label }, i) => (
              <div key={i} className="py-5 px-6 text-center" style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                <div className="text-xl font-bold" style={{ color: "#74CE52" }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <section className="py-16" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>Galería</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("rioCelesteDetail.galleryTitle")}</h2>
            <p style={{ color: "rgba(255,255,255,0.45)" }}>{t("rioCelesteDetail.gallerySubtitle")}</p>
          </div>
          <div className="relative max-w-6xl mx-auto">
            <button onClick={() => scrollGallery("left")} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110" style={{ backgroundColor: "#080d09", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
              <ChevronLeft size={18} />
            </button>
            <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto pb-3" style={{ scrollBehavior: "smooth", scrollbarWidth: "none" }}>
              {galleryImages.map((img, i) => (
                <div key={i} className="flex-shrink-0 w-72 h-52 rounded-xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.03]" style={{ border: "1px solid rgba(255,255,255,0.06)" }} onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
                  <img src={img} alt={`Río Celeste ${i + 1}`} className="w-full h-full object-cover brightness-90 group-hover:brightness-110 transition-all duration-300" />
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
          <button onClick={() => setLightboxOpen(false)} className="absolute top-5 right-5 text-white/70 hover:text-white"><X size={28} /></button>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(p => (p - 1 + galleryImages.length) % galleryImages.length); }} className="absolute left-4 text-white/60 hover:text-white text-5xl">‹</button>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(p => (p + 1) % galleryImages.length); }} className="absolute right-4 text-white/60 hover:text-white text-5xl">›</button>
          <img src={galleryImages[lightboxIndex]} alt={`Imagen ${lightboxIndex + 1}`} className="max-w-[88vw] max-h-[88vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{lightboxIndex + 1} / {galleryImages.length}</div>
        </div>
      )}

      {/* About */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">{t("rioCelesteDetail.differentProject")}</h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t("rioCelesteDetail.differentProjectDesc")}</p>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>Precios</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">{t("rioCelesteDetail.pricingTitle")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { badge: t("rioCelesteDetail.smallLotsStarting"), title: t("rioCelesteDetail.smallLotsTitle"), perM2: "$45", total: "$58,500", highlight: false },
              { badge: t("rioCelesteDetail.largeLotsStarting"), title: t("rioCelesteDetail.largeLotsTitle"), perM2: "$30", total: "$150,000", highlight: true },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl overflow-hidden transition-all hover:-translate-y-1" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: card.highlight ? "1px solid rgba(116,206,82,0.4)" : "1px solid rgba(255,255,255,0.07)" }}>
                <div className="py-3 text-center text-xs font-semibold" style={{ backgroundColor: card.highlight ? "rgba(116,206,82,0.15)" : "rgba(255,255,255,0.04)", color: card.highlight ? "#74CE52" : "rgba(255,255,255,0.5)" }}>
                  {card.badge}
                </div>
                <div className="p-8 text-center">
                  <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
                  <p className="text-4xl font-bold mb-1" style={{ color: "#74CE52" }}>{card.perM2}</p>
                  <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{t("rioCelesteDetail.perSquareMeter")}</p>
                  <p className="text-2xl font-semibold text-white">{card.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Options */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <img src={projectImages[1]} alt="Río Celeste vista" className="rounded-2xl shadow-lg w-full h-80 object-cover" style={{ border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t("rioCelesteDetail.investmentOptions")}</h2>
              <ul className="space-y-4">
                {[t("rioCelesteDetail.investmentOption1"), t("rioCelesteDetail.investmentOption2"), t("rioCelesteDetail.investmentOption3"), t("rioCelesteDetail.investmentOption4")].map((item, i) => (
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

      {/* River Access highlight */}
      <section className="py-20 text-center" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(116,206,82,0.12)" }}>
            <svg className="w-8 h-8" style={{ color: "#74CE52" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t("rioCelesteDetail.riverAccessTitle")}</h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{t("rioCelesteDetail.riverAccessDesc")}</p>
        </div>
      </section>

      {/* Project photos grid */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 text-center">{t("rioCelesteDetail.naturalResortTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {projectImages.map((img, i) => (
              <div key={i} className="rounded-2xl overflow-hidden h-72" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <img src={img} alt={`Río Celeste ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Common Areas */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t("rioCelesteDetail.commonAreasTitle")}</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: "🍖", text: t("rioCelesteDetail.commonArea1") },
              { icon: "🚿", text: t("rioCelesteDetail.commonArea2") },
              { icon: "🥾", text: t("rioCelesteDetail.commonArea3") },
              { icon: "🧘", text: t("rioCelesteDetail.commonArea4") },
              { icon: "🌿", text: t("rioCelesteDetail.commonArea5") },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:-translate-y-0.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-3xl">{f.icon}</span>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lot Distribution */}
      <section id="distribucion-lotes" className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.12)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.25)" }}>
              {t("rioCelesteDetail.investmentOpportunity")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("rioCelesteDetail.mapTitle")}</h2>
            <p style={{ color: "rgba(255,255,255,0.45)" }}>{t("rioCelesteDetail.mapSubtitle")}</p>
          </div>

          <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-6">
            {/* Interactive map */}
            <div className="lg:col-span-3">
              <div ref={mapPanelRef} className="rounded-2xl p-4 pb-3" style={{ backgroundColor: "#0a0f0b", border: "1px solid rgba(255,255,255,0.07)" }}>
                <RioCelesteMapInteractive
                  lots={lots}
                  selectedLot={selectedLot}
                  onLotSelect={(lot) => {
                    setSelectedLot(lot);
                    if (lot && lotListRef.current) {
                      const el = lotListRef.current.querySelector(`[data-lot-id="${lot.id}"]`);
                      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                  }}
                />
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
                    {t("rioCelesteDetail.availableLots")} <span style={{ color: "#74CE52" }}>({lots.filter(l => l.available).length})</span>
                  </h3>
                </div>
                <div ref={lotListRef} className="overflow-y-auto flex-1 min-h-0" style={{ backgroundColor: "#0a0f0b" }}>
                  {[...lots].sort((a, b) => a.id - b.id).map((lot) => {
                    const isSelected = selectedLot?.id === lot.id;
                    return (
                      <div
                        key={lot.id}
                        data-lot-id={lot.id}
                        onClick={() => lot.available && setSelectedLot(isSelected ? null : lot)}
                        className="px-5 py-4 transition-all"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: lot.available ? "pointer" : "not-allowed",
                          backgroundColor: isSelected ? "rgba(116,206,82,0.08)" : "transparent",
                          borderLeft: isSelected ? "3px solid #74CE52" : "3px solid transparent",
                          opacity: !lot.available ? 0.4 : 1,
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">Lote {lot.id}</span>
                              {!lot.available && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                                  {t("rioCelesteDetail.noAvailable")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{lot.size.toLocaleString("es-CR")} m²</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm" style={{ color: "#74CE52" }}>{formatUSD(lot.total)}</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>${lot.pricePerM2}/m²</p>
                          </div>
                        </div>

                        {isSelected && lot.available && (
                          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Tamaño</p>
                                <p className="font-bold text-white text-sm">{lot.size.toLocaleString("es-CR")} m²</p>
                              </div>
                              <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Precio/m²</p>
                                <p className="font-bold text-white text-sm">${lot.pricePerM2} USD</p>
                              </div>
                            </div>
                            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "rgba(116,206,82,0.08)", border: "1px solid rgba(116,206,82,0.18)" }}>
                              <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Precio total aprox.</p>
                              <p className="font-bold text-lg" style={{ color: "#74CE52" }}>{formatUSD(lot.total)}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); window.open(`https://api.whatsapp.com/send?phone=50684142111&text=${encodeURIComponent(`Hola, me interesa el Lote ${lot.id} de ${lot.size.toLocaleString("es-CR")} m² en Oasis Río Celeste. Precio aprox: ${formatUSD(lot.total)}`)}`, "_blank"); }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: "#74CE52" }}
                              >
                                <Info className="w-3 h-3" /> Solicitar Info
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); window.location.href = "/agendar-visita"; }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/10"
                                style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}
                              >
                                <Calendar className="w-3 h-3" /> {t("rioCelesteDetail.scheduleVisit")}
                              </button>
                              {lot.planoVisado && (
                                <button
                                  onClick={e => { e.stopPropagation(); window.open(lot.planoVisado, "_blank"); }}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                                  style={{ color: "#74CE52", border: "1px solid rgba(116,206,82,0.3)" }}
                                >
                                  <FileText className="w-3 h-3" /> {t("rioCelesteDetail.viewPlan")}
                                </button>
                              )}
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

          {/* Disclaimer */}
          <div className="max-w-3xl mx-auto mt-8">
            <div className="rounded-xl p-4 text-center text-sm" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "rgba(251,191,36,0.8)" }}>
              <strong>{t("rioCelesteDetail.priceNote")}</strong>{" "}{t("rioCelesteDetail.priceNoteText")}
            </div>
          </div>
        </div>
      </section>

      {/* Financing */}
      <FinancingSection onContactClick={handleContactClick} />

      {/* Location */}
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">{t("rioCelesteDetail.locationTitle")}</h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{t("rioCelesteDetail.locationDesc")}</p>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-20" style={{ backgroundColor: "#0d1410" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t("rioCelesteDetail.targetTitle")}</h2>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { title: t("rioCelesteDetail.targetInvestor"), text: t("rioCelesteDetail.targetInvestorDesc") },
              { title: t("rioCelesteDetail.targetPatrimonial"), text: t("rioCelesteDetail.targetPatrimonialDesc") },
              { title: t("rioCelesteDetail.targetLifestyle"), text: t("rioCelesteDetail.targetLifestyleDesc") },
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
      <section className="py-20" style={{ backgroundColor: "#0a0f0b" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 text-center">{t("rioCelesteDetail.summaryTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {[t("rioCelesteDetail.summary1"), t("rioCelesteDetail.summary2"), t("rioCelesteDetail.summary3"), t("rioCelesteDetail.summary4"), t("rioCelesteDetail.summary5"), t("rioCelesteDetail.summary6"), t("rioCelesteDetail.summary7"), t("rioCelesteDetail.summary8")].map((item, i) => (
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
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t("rioCelesteDetail.ctaTitle")}</h2>
          <p className="text-lg mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t("rioCelesteDetail.ctaDesc")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={handleContactClick} className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.03]" style={{ backgroundColor: "#74CE52" }}>
              <MessageCircle className="w-4 h-4" />
              {t("rioCelesteDetail.requestInfo")}
            </button>
            <button onClick={() => window.location.href = "/agendar-visita"} className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all hover:bg-white/12" style={{ color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.18)" }}>
              {t("rioCelesteDetail.scheduleVisit")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
