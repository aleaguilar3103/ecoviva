import { createContext, useContext, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type LanguageCode = "es" | "en";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ locale, children }: { locale: LanguageCode; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const setLanguage = (lang: LanguageCode) => {
    if (lang === locale) return;

    const rawPath =
      locale === "en"
        ? location.pathname.replace(/^\/en/, "") || "/"
        : location.pathname;

    const newPath = lang === "en" ? (rawPath === "/" ? "/en" : `/en${rawPath}`) : rawPath;

    localStorage.setItem("ecoviva_locale", lang);

    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event: "locale_change", page_locale: lang });
    }

    navigate(newPath);
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[locale];
    for (const k of keys) value = value?.[k];
    return value !== undefined ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language: locale, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}

const translations: Record<LanguageCode, any> = {
  es: {
    header: {
      inicio: "Inicio",
      proyectos: "Proyectos",
      calculadora: "Calculadora de financiamiento",
      financiamiento: "Financiamiento",
      contacto: "Contacto",
      hablarAhora: "Hablar Ahora",
    },
    hero: {
      title:
        "Proyectos Inmobiliarios en las mejores locaciones de la Zona Norte de Costa Rica.",
      subtitle: "Financiamiento Sin Prima Ni Fiador.",
      description:
        "Creamos proyectos sostenibles con alto potencial de crecimiento. Financiamos al 100% — sin prima, sin fiador y sin estudio crediticio. Impulsamos inversiones seguras y proyectos que transforman la región.",
      description1:
        "Creamos proyectos sostenibles, con alto potencial de crecimiento.",
      financing:
        "💰 Financiamos al 100% — sin prima, sin fiador y sin estudio crediticio.",
      description2:
        "Impulsamos inversiones seguras y proyectos que transforman la región.",
      cta: "Nuestros Proyectos",
      ctaSecondary: "Ver proyectos",
    },
    stats: {
      projects: "Proyectos",
      lots: "Lotes",
      downPayment: "Prima inicial",
      term: "Años plazo",
    },
    projects: {
      title: "Nuestros Proyectos",
      subtitle:
        "Inversiones únicas en las zonas más privilegiadas del norte de Costa Rica",
      rioCeleste: {
        title: "Río Celeste Oasis",
        location: "Katira, Guatuso · Zona Norte, Alajuela",
        price: "",
        size: "Desde 1.300 m² hasta 5.000 m²",
        features: [
          "Acceso privado y directo al Río Celeste",
          "15 quintas de 5.000 m² + lotes desde 1.300 m²",
          "Seguridad: control de acceso",
          "Ranchos BBQ, baños, senderos y deck",
        ],
        badges: ["Disponible", "Acceso privado al río", "Balneario natural"],
        description:
          "El Río Celeste es famoso por su color turquesa único en el mundo. Ofrecemos lotes de 1300m2 y 5000m2 desde los $30 y los $45 por m2, con acceso directo al río, privacidad total y un potencial extraordinario para Airbnb, glamping o finca de retiro.",
        viewDetails: "Ver detalles",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada, San Carlos",
        price: "",
        size: "Lotes desde 600 m² hasta 5,000 m²",
        features: [
          "Vistas panorámicas espectaculares",
          "Cerca de la ciudad y todos los servicios",
          "Clima único de montaña",
          "Zona con Plan Regulador activo",
        ],
        badges: ["Premium", "Vistas Espectaculares", "Cerca de todo"],
        description:
          "Ubicado en Ciudad Quesada con vistas panorámicas, clima único y ubicación estratégica. Lotes desde ₡45,000/m² (600 m²) hasta ₡13,000/m² (5,000 m²). Zona con planificación activa y desarrollo sostenible.",
        viewDetails: "Ver detalles",
      },
      financingDetails: [
        "Financiamiento al 100% sin prima",
        "Sin fiador ni estudio crediticio",
        "Trámite sencillo",
        "Mejores condiciones del mercado",
      ],
    },
    calculator: {
      title: "Calculadora de Financiamiento",
      subtitle:
        "Calcula tu cuota mensual y descubre lo accesible que es invertir en tu propiedad",
      financingData: "Datos del financiamiento",
      currency: "Moneda",
      lotValue: "Valor del Lote (USD)",
      lotValueCRC: "Valor del Lote (CRC)",
      term: "Plazo (años)",
      selectTerm: "Seleccionar plazo",
      years: "años",
      rate: "Tasa Anual (%)",
      rateUSD: "Tasa de interés en USD: 9% anual",
      rateCRC: "Tasa de interés en Colones: 8% anual",
      calculate: "Calcular",
      monthlyPayment: "Cuota Mensual",
      totalPayment: "Monto Total",
      totalInterest: "Intereses Totales",
      downPaymentRequired: "Prima requerida",
      disclaimer: "Sin fiador. Sin estudio crediticio. Sujeto a disponibilidad del proyecto.",
      cta: "Quiero este financiamiento",
      perMonth: "mes",
    },
    financing: {
      badge: "Inversión Inteligente",
      title: "Financiamiento del 100%",
      subtitle:
        "Sin prima, sin bancos, sin fiador. Elegís el lote, activamos el plan y empezás a invertir sin trámites bancarios ni papeleo eterno.",
      highlight: "✨ Ofrecemos las mejores condiciones del mercado ✨",
      noPrima: "Sin Prima",
      noPrimaDesc: "Comienza tu inversión sin necesidad de pago inicial",
      noBanks: "Sin Bancos, Sin Fiador",
      noBanksDesc: "Proceso directo sin trámites bancarios ni papeleo eterno",
      requirements: "Requisitos Mínimos",
      requirementsDesc: "Solo cédula de identidad y visión",
      conditionsTitle: "Las Mejores Condiciones del Mercado",
      bestRates: "Tasas Competitivas",
      bestRatesDesc: "Tasas de interés justas y transparentes, diseñadas para tu éxito",
      flexibility: "Flexibilidad Total",
      flexibilityDesc: "Plazos adaptables a tus necesidades, desde 2 hasta 10 años",
      transparency: "Transparencia Absoluta",
      transparencyDesc: "Sin costos ocultos ni sorpresas. Todo claro desde el inicio",
      cta: "Quiero mi aprobación",
      ctaSubtext: "Respuesta en menos de 24 horas",
    },
    contact: {
      title: "Contáctanos",
      subtitle: "Estamos aquí para responder todas tus preguntas",
      info: "Información de Contacto",
      phone: "Teléfono",
      email: "Email",
      location: "Ubicación",
      locationValue: "Norte de Costa Rica",
      form: {
        name: "Nombre Completo",
        namePlaceholder: "Tu nombre",
        email: "Correo Electrónico",
        emailPlaceholder: "tu@email.com",
        phone: "Teléfono",
        phonePlaceholder: "+506 1234 5678",
        message: "Mensaje",
        messagePlaceholder: "¿En qué podemos ayudarte?",
        submit: "Enviar Mensaje",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Desarrollos de lujo en armonía con la naturaleza costarricense",
      quickLinks: "Enlaces Rápidos",
      inicio: "Inicio",
      proyectos: "Proyectos",
      financiamiento: "Financiamiento",
      contacto: "Contacto",
      contactTitle: "Contacto",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. Todos los derechos reservados.",
    },
    survey: {
      title: "Encuesta",
      subtitle: "Ayúdanos a conocerte mejor para ofrecerte la mejor experiencia.",
    },
    financingBanner: {
      headline: "Financiamiento del 100%",
      subheadline: "Solo con tu cédula hacemos el estudio. Sin prima, sin fiador.",
      noPrima: "Sin prima",
      noFiador: "Sin fiador",
      soloCedula: "Solo con cédula",
      cta: "Aplicar ahora",
    },
    booking: {
      badge: "Agenda tu visita",
      heroTitle: "Conoce tu futuro hogar en Costa Rica",
      heroSubtitle:
        "Agenda una visita guiada a nuestros proyectos y descubre por qué cientos de familias ya eligieron invertir con Eco Viva Desarrollos.",
      location: "Zona Norte, Costa Rica",
      available: "Visitas disponibles todos los días",
      whySchedule: "¿Por qué agendar una visita?",
      whyScheduleDesc:
        "Una visita presencial te permite conocer de primera mano la calidad de nuestros desarrollos, las vistas impresionantes y el potencial de inversión.",
      benefit1: "Recorrido personalizado por los proyectos",
      benefit2: "Asesoría financiera sin compromiso",
      benefit3: "Conoce las amenidades en persona",
      benefit4: "Explora los lotes disponibles",
      preferDirect: "¿Prefieres contacto directo?",
      preferDirectDesc:
        "Nuestro equipo está disponible para atenderte por WhatsApp y coordinar tu visita de forma inmediata.",
      contactWhatsApp: "Contactar por WhatsApp",
      selectDateTime: "Selecciona fecha y hora",
      selectDateTimeDesc: "Elige el momento ideal para tu visita",
      readyNext: "¿Listo para dar el siguiente paso?",
      readyNextDesc:
        "Agenda tu visita hoy y descubre por qué Costa Rica es el destino ideal para tu inversión en bienes raíces.",
      scheduleNow: "Agendar ahora",
    },
    rioCelesteDetail: {
      heroTitle: "Río Celeste Oasis",
      heroSubtitle: "Balneario Natural Privado · Quintas y Lotes Exclusivos",
      heroDescription:
        "Un proyecto inmobiliario único con acceso privado y directo al Río Celeste, diseñado como un balneario natural de baja densidad en una de las zonas turísticas con mayor proyección de crecimiento en Costa Rica.",
      requestInfo: "Solicitar información",
      scheduleVisit: "Agendar visita",
      galleryTitle: "Galería del proyecto",
      gallerySubtitle: "Naturaleza, río y amenidades del balneario natural.",
      differentProject: "Un proyecto diferente a todo lo demás en la zona",
      differentProjectDesc:
        "Río Celeste Oasis no es una lotificación tradicional. Es un desarrollo concebido como un balneario natural privado, donde la baja densidad, la privacidad y el acceso directo al río crean un entorno exclusivo, escaso y altamente atractivo para inversión turística, retiro o segunda residencia.",
      investmentOptions: "Opciones de inversión dentro del proyecto",
      investmentOption1: "15 quintas exclusivas de 5.000 m²",
      investmentOption2: "Lotes frente a calle desde 1.300 m²",
      investmentOption3: "Ingreso flexible según perfil de inversión",
      investmentOption4:
        "Ideal para villas privadas, Airbnb premium, glamping o fincas de retiro",
      riverAccessTitle: "Acceso privado y directo al Río Celeste",
      riverAccessDesc:
        "Cada propiedad cuenta con acceso privado al río. El Río Celeste no es un atractivo cercano: es parte integral del proyecto, permitiendo experiencias de descanso, recreación, bienestar y contacto directo con la naturaleza.",
      naturalResortTitle: "Concepto de balneario natural",
      commonAreasTitle: "Áreas comunes del proyecto",
      commonArea1: "Ranchos BBQ totalmente equipados",
      commonArea2: "Baños comunes modernos y funcionales",
      commonArea3: "Senderos naturales internos",
      commonArea4: "Deck para yoga, meditación y actividades",
      commonArea5: "Zonas de descanso y contemplación",
      securityTitle: "Seguridad, privacidad y control",
      security1: "Acceso controlado al proyecto",
      security2: "Cámaras de seguridad en puntos estratégicos",
      security3: "Ambiente rural, privado y de baja densidad",
      security4: "Diseñado para tranquilidad de propietarios y huéspedes",
      locationTitle: "Ubicación estratégica y alto potencial de crecimiento",
      locationDesc:
        "Ubicado en Katira de Guatuso, Alajuela, con conectividad directa por la Ruta Nacional 4 y cercanía a los principales polos de turismo de naturaleza de la Zona Norte. Esta región ha sido identificada por el Instituto Costarricense de Turismo como una de las zonas con mayor proyección de crecimiento turístico del país.",
      targetTitle: "¿Para quién es Río Celeste Oasis?",
      targetInvestor: "Inversionista turístico",
      targetInvestorDesc: "Rentas cortas, glamping y villas boutique con alto atractivo natural.",
      targetPatrimonial: "Comprador patrimonial",
      targetPatrimonialDesc: "Tierra escasa, acceso al río y proyección de plusvalía.",
      targetLifestyle: "Comprador lifestyle",
      targetLifestyleDesc: "Retiro, segunda residencia y conexión con la naturaleza.",
      summaryTitle: "Resumen de valor del proyecto",
      summary1: "Lotes desde 1.300 m² hasta 5.000 m²",
      summary2: "15 quintas exclusivas",
      summary3: "Acceso privado al Río Celeste",
      summary4: "Concepto de balneario natural",
      summary5: "Áreas comunes completas",
      summary6: "Seguridad y control de acceso",
      summary7: "Zona de alto crecimiento turístico",
      summary8: "Proyecto único en su categoría",
      ctaTitle: "Una inversión donde la naturaleza es el activo",
      ctaDesc:
        "Río Celeste Oasis representa una oportunidad única de inversión en tierra escasa, con alto potencial turístico y un entorno natural que no se puede replicar.",
      pricingTitle: "Opciones de lotes disponibles",
      smallLotsStarting: "Desde 1,300 m²",
      smallLotsTitle: "Lotes pequeños desde 1,300 m²",
      largeLotsStarting: "Desde 5,000 m²",
      largeLotsTitle: "Lotes grandes desde 5,000 m²",
      perSquareMeter: "por metro cuadrado",
      investmentOpportunity: "Oportunidad de Inversión",
      mapTitle: "Oasis Río Celeste – Distribución de Lotes",
      mapSubtitle: "Lotes disponibles con precios aproximados según tamaño",
      availableLots: "Lotes Disponibles",
      lotsAvailable: "Lotes disponibles",
      minimumSize: "Tamaño mínimo",
      maximumSize: "Tamaño máximo",
      from: "Desde",
      priceNote: "Nota:",
      priceNoteText:
        "Los precios son aproximados y pueden variar según condiciones específicas del lote.",
      noAvailable: "No Disponible",
      viewPlan: "Ver Plano",
    },
    lomasLlanadaDetail: {
      heroTitle: "Lomas de la Llanada",
      heroSubtitle: "Vistas Espectaculares · Ciudad Quesada, San Carlos",
      heroDescription:
        "Un proyecto inmobiliario con vistas panorámicas, clima único y ubicación estratégica en el corazón de Ciudad Quesada. Lotes desde 600 m² hasta 5,000 m² en una zona con planificación activa y desarrollo sostenible.",
      requestInfo: "Solicitar información",
      scheduleVisit: "Agendar visita",
      downloadInfo: "Descarga información general",
      videoTitle: "Conoce Lomas de la Llanada",
      videoSubtitle: "Descubre las vistas y el entorno único de este proyecto",
      galleryTitle: "Galería del proyecto",
      gallerySubtitle: "Vistas panorámicas y entorno natural de Lomas de la Llanada",
      differentProject: "Un proyecto en el corazón de la ciudad con visión de futuro",
      differentProjectDesc:
        "Lomas de la Llanada forma parte de un entorno con visión, planificación y respaldo institucional. No es solo un proyecto rodeado de naturaleza, sino una inversión dentro de una ciudad que crece con orden, participación comunitaria y enfoque sostenible.",
      videoFeature1: "Recorrido aéreo del proyecto",
      videoFeature2: "Vistas panorámicas reales",
      videoFeature3: "Naturaleza y tranquilidad garantizadas",
      pricingTitle: "Opciones de lotes disponibles",
      startingPrice: "Desde 600 m²",
      price600Title: "Lotes desde 600 m²",
      perSquareMeter: "por metro cuadrado",
      price600Desc:
        "Ideales para construcción de vivienda familiar. Ubicados a orilla de calle con fácil acceso.",
      premiumView: "Vista Panorámica",
      price5000ViewTitle: "Lotes de 5,000 m² con vista",
      price5000ViewDesc:
        "Lotes premium con vistas panorámicas espectaculares a Ciudad Quesada y el Volcán Arenal.",
      bestValue: "Mejor valor",
      price5000Title: "Lotes de 5,000 m² sin vista",
      price5000Desc: "Amplios lotes a excelente precio para desarrollo residencial o agrícola.",
      strategicLocationTitle: "Ubicación dentro de un distrito con planificación activa",
      strategicLocationDesc:
        "Lomas de la Llanada se ubica en Ciudad Quesada, el distrito central del cantón de San Carlos, una zona que cuenta con un Plan Regulador moderno que garantiza crecimiento ordenado, usos de suelo compatibles y desarrollo sostenible a largo plazo.",
      keyFeaturesTitle: "¿Por qué invertir en Lomas de la Llanada?",
      feature1Title: "Planificación activa",
      feature1Desc:
        "Ubicado en un distrito con Plan Regulador moderno que garantiza crecimiento ordenado y desarrollo sostenible.",
      feature2Title: "Armonía con la naturaleza",
      feature2Desc:
        "El Plan Regulador prioriza un modelo de desarrollo equilibrado con el entorno natural, protegiendo la plusvalía.",
      feature3Title: "Gobernanza participativa",
      feature3Desc:
        "Ciudad Quesada cuenta con un modelo de gobernanza territorial participativa que brinda seguridad para la inversión.",
      feature4Title: "Visión urbana moderna",
      feature4Desc:
        "Mejoras futuras en movilidad como infraestructura peatonal, ciclovías y soluciones urbanas modernas.",
      feature5Title: "Espacios públicos",
      feature5Desc:
        "Sólida red de parques, zonas verdes, plazas públicas y áreas comunales cerca del proyecto.",
      feature6Title: "Servicios consolidados",
      feature6Desc: "Cerca de mercado municipal, biblioteca, centros administrativos y comercio activo.",
      urbanVisionTitle: "Visión urbana moderna y funcional",
      urbanVision1: "Infraestructura peatonal y ciclovías proyectadas",
      urbanVision2: "Ciudad más accesible, ordenada y centrada en las personas",
      urbanVision3: "Reducción de impactos negativos como ruido y congestión",
      urbanVision4: "Usos de suelo compatibles con residencia de calidad",
      servicesTitle: "Infraestructura de servicios consolidados",
      service1: "Mercado municipal cercano",
      service2: "Biblioteca y centros administrativos",
      service3: "Comercio activo y servicios esenciales",
      service4: "Acceso a hospitales y centros de salud",
      connectivityTitle: "Conectividad y base para crecimiento futuro",
      connectivityDesc:
        "El distrito cuenta con una red vial inventariada y terrenos estratégicos destinados al crecimiento ordenado, lo que asegura conectividad, acceso y proyección de desarrollo a mediano y largo plazo.",
      targetTitle: "¿Para quién es Lomas de la Llanada?",
      targetFamily: "Familias jóvenes",
      targetFamilyDesc: "Ambiente tranquilo, cerca de servicios y escuelas, con espacio para crecer.",
      targetInvestor: "Inversionista patrimonial",
      targetInvestorDesc:
        "Tierra con alto potencial de plusvalía en zona de crecimiento planificado.",
      targetRetiree: "Jubilados y retirados",
      targetRetireeDesc: "Clima único, vistas espectaculares y cercanía a servicios de salud.",
      summaryTitle: "Resumen de valor del proyecto",
      summary1: "Lotes desde 600 m² hasta 5,000 m²",
      summary2: "Vistas panorámicas espectaculares",
      summary3: "Cerca de la ciudad y todos los servicios",
      summary4: "Clima único de montaña",
      summary5: "Zona con Plan Regulador activo",
      summary6: "Alta proyección de plusvalía",
      summary7: "Gobernanza participativa",
      summary8: "Desarrollo sostenible garantizado",
      ctaTitle: "Una inversión con visión, planificación y respaldo",
      ctaDesc:
        "Lomas de la Llanada no es solo un proyecto rodeado de naturaleza, sino una inversión dentro de una ciudad que crece con orden, participación comunitiva y enfoque sostenible.",
      availableLots: "Lotes Disponibles",
      lotsAvailable: "Lotes disponibles",
      minimumSize: "Tamaño mínimo",
      maximumSize: "Tamaño máximo",
      from: "Desde",
      smallLotsTitle: "¿Buscas algo más pequeño?",
      smallLotsDesc:
        "También ofrecemos lotes más compactos de entre 690 y 1.300 m², ideales para quienes desean una opción más accesible dentro del mismo proyecto. Estos lotes están ubicados frente a calle pública, por lo que no cuentan con acceso privado como los lotes del bloque principal. La gran ventaja es que están completamente listos para construir: ya cuentan con agua potable y electricidad instalada. El financiamiento para estos lotes requiere una prima del 25%.",
      smallLotsFeature1: "Lotes de 690 a 1.300 m²",
      smallLotsFeature2: "Frente a calle pública",
      smallLotsFeature3: "Agua y electricidad instaladas",
      smallLotsFeature4: "Listos para construir",
      smallLotsFeature5: "Prima del 25% para financiamiento",
      smallLotsDownload: "Descargar información completa",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EN — adapted copy for international buyers / expats / investors
  // NOT a literal translation. Different value props, different conversation.
  // ─────────────────────────────────────────────────────────────────────────────
  en: {
    header: {
      inicio: "Home",
      proyectos: "Projects",
      calculadora: "Financing Calculator",
      financiamiento: "Financing",
      contacto: "Contact",
      hablarAhora: "Talk to Us",
    },
    hero: {
      title:
        "Own land near Río Celeste — one of the world's most iconic destinations.",
      subtitle: "Direct financing from the developer. No banks. No middlemen.",
      description:
        "Costa Rica allows 100% foreign ownership of land. Invest in a growing natural corridor with direct developer financing — no bank approval required.",
      description1: "Costa Rica allows 100% foreign ownership of land.",
      financing:
        "💰 Direct developer financing — no bank required, no middleman, no hassle.",
      description2:
        "Invest in a growing natural corridor with predictable USD returns.",
      cta: "See Available Lots",
      ctaSecondary: "View projects",
    },
    stats: {
      projects: "Projects",
      lots: "Lots",
      downPayment: "Down payment",
      term: "Year terms",
    },
    projects: {
      title: "Our Projects",
      subtitle: "Investment-grade land in Costa Rica's emerging northern corridor",
      rioCeleste: {
        title: "Río Celeste Oasis",
        location: "Katira, Guatuso · North Zone, Alajuela",
        price: "",
        size: "Lots from 1,300 m² to 5,000 m²",
        features: [
          "Private direct access to Río Celeste",
          "15 exclusive estates of 5,000 m² + lots from 1,300 m²",
          "Gated access control",
          "BBQ pavilions, trails, yoga deck",
        ],
        badges: ["Available", "Private river access", "Natural resort"],
        description:
          "Featured by National Geographic and Lonely Planet — Río Celeste's electric-blue waters are one of nature's true wonders. Own a piece of it: private river access, USD pricing from $30/m², and direct developer financing with no bank required.",
        viewDetails: "View details",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada, San Carlos",
        price: "",
        size: "Lots from 600 m² to 5,000 m²",
        features: [
          "Panoramic mountain views",
          "Walking distance to city amenities",
          "Mild highland climate year-round",
          "Active regulated growth zone",
        ],
        badges: ["Premium", "Panoramic Views", "City Amenities"],
        description:
          "Mountain lots with sweeping views of Ciudad Quesada and Arenal Volcano. A regulated, planned-growth district with strong infrastructure — ideal for a home base, retirement, or long-term land appreciation.",
        viewDetails: "View details",
      },
      financingDetails: [
        "Simple financing, direct from developer",
        "No bank approval, no guarantor",
        "Qualify with just your ID or passport",
        "Best terms on the market",
      ],
    },
    calculator: {
      title: "Financing Calculator",
      subtitle:
        "Estimate your monthly payment and see how affordable land ownership in Costa Rica can be",
      financingData: "Financing Details",
      currency: "Currency",
      lotValue: "Lot Value (USD)",
      lotValueCRC: "Lot Value (CRC)",
      term: "Term (years)",
      selectTerm: "Select term",
      years: "years",
      rate: "Annual Rate (%)",
      rateUSD: "USD interest rate: 9% annual",
      rateCRC: "Colones interest rate: 8% annual",
      calculate: "Calculate",
      monthlyPayment: "Monthly Payment",
      totalPayment: "Total Amount",
      totalInterest: "Total Interest",
      downPaymentRequired: "Down payment required",
      disclaimer:
        "No bank required. Qualify with your passport or ID. Subject to lot availability.",
      cta: "I want this financing",
      perMonth: "month",
    },
    financing: {
      badge: "Smart Investment",
      title: "Simple financing, direct from the developer",
      subtitle:
        "No bank approval. No middlemen. Choose your lot, sign directly with us, and start building equity in Costa Rica.",
      highlight: "✨ The best financing terms on the market ✨",
      noPrima: "No Down Payment",
      noPrimaDesc:
        "Start your investment with zero down — unusually flexible for Costa Rica real estate",
      noBanks: "No Bank Required",
      noBanksDesc:
        "Finance directly with the developer — faster approval, less paperwork, no credit bureau",
      requirements: "Minimal Requirements",
      requirementsDesc: "Just your passport or ID — that's it",
      conditionsTitle: "Why Finance Directly With the Developer",
      bestRates: "Competitive USD Rates",
      bestRatesDesc: "Transparent interest rates in USD — no currency surprise, no hidden fees",
      flexibility: "Flexible Terms",
      flexibilityDesc: "2 to 15-year payment plans tailored to your budget",
      transparency: "Full Transparency",
      transparencyDesc: "Everything in writing from day one. No surprises at closing.",
      cta: "Get pre-approved",
      ctaSubtext: "Response within 24 hours",
    },
    contact: {
      title: "Get in Touch",
      subtitle: "Our team speaks English — we're here to walk you through every step",
      info: "Contact Information",
      phone: "Phone / WhatsApp",
      email: "Email",
      location: "Location",
      locationValue: "Northern Costa Rica",
      form: {
        name: "Full Name",
        namePlaceholder: "Your name",
        email: "Email",
        emailPlaceholder: "your@email.com",
        phone: "Phone / WhatsApp",
        phonePlaceholder: "+1 555 123 4567",
        message: "Message",
        messagePlaceholder:
          "Tell us what you're looking for — we'll find the right lot for you.",
        submit: "Send Message",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Land ownership in Costa Rica — simple, direct, developer-financed",
      quickLinks: "Quick Links",
      inicio: "Home",
      proyectos: "Projects",
      financiamiento: "Financing",
      contacto: "Contact",
      contactTitle: "Contact",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. All rights reserved.",
    },
    survey: {
      title: "Survey",
      subtitle: "Help us match you with the right lot — takes under a minute.",
    },
    financingBanner: {
      headline: "Developer financing — no bank needed",
      subheadline: "Qualify with your passport or ID. Simple process, direct approval.",
      noPrima: "No down payment",
      noFiador: "No guarantor",
      soloCedula: "Passport or ID accepted",
      cta: "Apply now",
    },
    booking: {
      badge: "Schedule a site visit",
      heroTitle: "See your future land in person",
      heroSubtitle:
        "Book a guided tour of our projects and experience firsthand why investors from North America and Europe are choosing Costa Rica's northern zone.",
      location: "Northern Zone, Costa Rica",
      available: "Tours available every day",
      whySchedule: "Why visit in person?",
      whyScheduleDesc:
        "Nothing replaces standing on the land — seeing the river, the views, and the scale of the opportunity firsthand.",
      benefit1: "Guided tour of both projects",
      benefit2: "No-obligation financing consultation",
      benefit3: "See the amenities and common areas",
      benefit4: "Walk the available lots",
      preferDirect: "Prefer to reach out directly?",
      preferDirectDesc:
        "Our English-speaking team is available via WhatsApp to coordinate your visit.",
      contactWhatsApp: "Message us on WhatsApp",
      selectDateTime: "Pick a date and time",
      selectDateTimeDesc: "Choose what works for your schedule",
      readyNext: "Ready to move forward?",
      readyNextDesc:
        "Schedule your visit today and see why Costa Rica is one of the most accessible foreign land ownership markets in the world.",
      scheduleNow: "Schedule now",
    },
    rioCelesteDetail: {
      heroTitle: "Río Celeste Oasis",
      heroSubtitle: "Private Natural Resort · Exclusive Estates and Lots",
      heroDescription:
        "A boutique land project with private direct access to Río Celeste — one of National Geographic's most iconic natural destinations. Low density. USD pricing. Direct developer financing.",
      requestInfo: "Request information",
      scheduleVisit: "Schedule a visit",
      galleryTitle: "Project Gallery",
      gallerySubtitle: "The river, the nature, the resort amenities — all yours.",
      differentProject: "This isn't a standard subdivision",
      differentProjectDesc:
        "Río Celeste Oasis is a private natural resort concept — low density, direct river access, gated. Designed for boutique Airbnb, glamping operations, private retreats, or simply owning a piece of one of the world's most photographed rivers.",
      investmentOptions: "Investment options",
      investmentOption1: "15 exclusive 5,000 m² estates",
      investmentOption2: "Street-front lots from 1,300 m²",
      investmentOption3: "Flexible entry points by investment size",
      investmentOption4: "Ideal for boutique Airbnb, glamping, or private retreat",
      riverAccessTitle: "Private access to Río Celeste",
      riverAccessDesc:
        "Every property includes private access to the river. Río Celeste isn't nearby — it runs through the project. That's not something you can replicate.",
      naturalResortTitle: "Natural resort concept",
      commonAreasTitle: "Shared amenities",
      commonArea1: "Fully equipped BBQ pavilions",
      commonArea2: "Modern shared bathrooms",
      commonArea3: "Nature trails through the property",
      commonArea4: "Yoga and meditation deck",
      commonArea5: "Rest and contemplation areas",
      securityTitle: "Security and privacy",
      security1: "Gated entry with access control",
      security2: "Security cameras at key points",
      security3: "Low-density rural environment",
      security4: "Designed for owner and guest peace of mind",
      locationTitle: "Strategic location with high growth potential",
      locationDesc:
        "Located in Katira de Guatuso, Alajuela — direct access via National Route 4, close to the main ecotourism hubs of Costa Rica's northern zone. The Costa Rican Tourism Institute has identified this corridor as one of the country's highest-growth tourism areas.",
      targetTitle: "Who is this project for?",
      targetInvestor: "Short-term rental investor",
      targetInvestorDesc:
        "Boutique Airbnb, glamping, or eco-lodge — Río Celeste's global recognition drives consistent demand.",
      targetPatrimonial: "Long-term land buyer",
      targetPatrimonialDesc:
        "Scarce land with private river access appreciates differently than a standard lot.",
      targetLifestyle: "Lifestyle buyer",
      targetLifestyleDesc:
        "A private retreat, second home, or off-grid escape in one of the world's great natural settings.",
      summaryTitle: "Project value at a glance",
      summary1: "Lots from 1,300 m² to 5,000 m²",
      summary2: "15 exclusive estates",
      summary3: "Private access to Río Celeste",
      summary4: "Natural resort concept",
      summary5: "Full shared amenities",
      summary6: "Gated with security",
      summary7: "High-growth tourism corridor",
      summary8: "Unique — nothing else like it in the area",
      ctaTitle: "An investment where nature is the asset",
      ctaDesc:
        "Río Celeste Oasis offers something scarce: private river access in a globally recognized destination, with direct developer financing and 100% foreign ownership rights.",
      pricingTitle: "Available lots",
      smallLotsStarting: "From 1,300 m²",
      smallLotsTitle: "Smaller lots from 1,300 m²",
      largeLotsStarting: "From 5,000 m²",
      largeLotsTitle: "Estates from 5,000 m²",
      perSquareMeter: "per m²",
      investmentOpportunity: "Investment Opportunity",
      mapTitle: "Oasis Río Celeste – Lot Map",
      mapSubtitle: "Available lots with approximate pricing by size",
      availableLots: "Available Lots",
      lotsAvailable: "Lots available",
      minimumSize: "Minimum size",
      maximumSize: "Maximum size",
      from: "From",
      priceNote: "Note:",
      priceNoteText: "Prices are approximate and may vary by specific lot conditions.",
      noAvailable: "Not Available",
      viewPlan: "View Site Plan",
    },
    lomasLlanadaDetail: {
      heroTitle: "Lomas de la Llanada",
      heroSubtitle: "Panoramic Views · Ciudad Quesada, San Carlos",
      heroDescription:
        "Mountain lots with panoramic views of Ciudad Quesada and Arenal Volcano. In a regulated, planned-growth district with strong city infrastructure — ideal for a home base, retirement, or long-term appreciation.",
      requestInfo: "Request information",
      scheduleVisit: "Schedule a visit",
      downloadInfo: "Download project overview",
      videoTitle: "See Lomas de la Llanada",
      videoSubtitle: "Experience the views and surroundings of this mountain project",
      galleryTitle: "Project Gallery",
      gallerySubtitle: "Panoramic views and natural surroundings of Lomas de la Llanada",
      differentProject: "A city-adjacent mountain project with a long view",
      differentProjectDesc:
        "Lomas de la Llanada sits within a district that has an active regulatory plan — orderly growth, protected land uses, community governance. It's not just land near nature. It's land within a city that's growing intentionally.",
      videoFeature1: "Aerial project tour",
      videoFeature2: "Real panoramic footage",
      videoFeature3: "Nature and tranquility guaranteed",
      pricingTitle: "Available lots",
      startingPrice: "From 600 m²",
      price600Title: "Lots from 600 m²",
      perSquareMeter: "per m²",
      price600Desc: "Ideal for family home construction. Streetside access, ready to build.",
      premiumView: "Panoramic View",
      price5000ViewTitle: "5,000 m² lots with view",
      price5000ViewDesc:
        "Premium lots with sweeping panoramic views of Ciudad Quesada and Arenal Volcano.",
      bestValue: "Best value",
      price5000Title: "5,000 m² lots — no view",
      price5000Desc: "Large lots at excellent price for residential or agricultural development.",
      strategicLocationTitle: "Within a planned-growth district",
      strategicLocationDesc:
        "Lomas de la Llanada is in Ciudad Quesada, the central district of San Carlos — one of Costa Rica's most organized mid-size cities. It has an active regulatory plan guaranteeing orderly growth, compatible land uses, and long-term sustainable development.",
      keyFeaturesTitle: "Why invest in Lomas de la Llanada?",
      feature1Title: "Regulated growth",
      feature1Desc:
        "An active regulatory plan means your investment is protected by urban order — not subject to speculative sprawl.",
      feature2Title: "Nature-balanced development",
      feature2Desc:
        "The plan prioritizes a development model in balance with the natural environment, protecting long-term property values.",
      feature3Title: "Community governance",
      feature3Desc:
        "Ciudad Quesada has a participatory territorial governance model — stability and accountability for investors.",
      feature4Title: "Modern urban vision",
      feature4Desc: "Planned improvements: pedestrian infrastructure, bike paths, modern mobility solutions.",
      feature5Title: "Public green spaces",
      feature5Desc:
        "Strong network of parks, green areas, public squares and community spaces near the project.",
      feature6Title: "Full city services",
      feature6Desc: "Municipal market, library, administrative centers, hospital — all within reach.",
      urbanVisionTitle: "A modern, functional urban vision",
      urbanVision1: "Projected pedestrian infrastructure and bike paths",
      urbanVision2: "A more accessible, organized, people-centered city",
      urbanVision3: "Reduced noise and congestion",
      urbanVision4: "Land uses compatible with quality residential living",
      servicesTitle: "City services at your doorstep",
      service1: "Municipal market nearby",
      service2: "Library and administrative centers",
      service3: "Commerce and essential services",
      service4: "Hospital and health centers accessible",
      connectivityTitle: "Connectivity and foundation for future growth",
      connectivityDesc:
        "The district has an inventoried road network and strategic land reserves for orderly expansion — ensuring connectivity and long-term development projection.",
      targetTitle: "Who is this project for?",
      targetFamily: "Families relocating to Costa Rica",
      targetFamilyDesc:
        "Quiet environment, close to schools and services, with room to build and grow.",
      targetInvestor: "Long-term land investor",
      targetInvestorDesc:
        "Land with strong appreciation potential in a planned-growth area — a solid store of value.",
      targetRetiree: "Retirees and expats",
      targetRetireeDesc:
        "Mild highland climate, spectacular views, and proximity to health services and city amenities.",
      summaryTitle: "Project value at a glance",
      summary1: "Lots from 600 m² to 5,000 m²",
      summary2: "Panoramic views of Arenal and the valley",
      summary3: "Walking distance to city amenities",
      summary4: "Mild highland climate year-round",
      summary5: "Active regulatory plan protecting growth",
      summary6: "Strong long-term appreciation",
      summary7: "Participatory governance",
      summary8: "Sustainable development guaranteed",
      ctaTitle: "An investment with vision, planning, and institutional backing",
      ctaDesc:
        "Lomas de la Llanada is not just land near nature. It's a position within a city that's growing with order, community participation, and a clear sustainable vision.",
      availableLots: "Available Lots",
      lotsAvailable: "Lots available",
      minimumSize: "Minimum size",
      maximumSize: "Maximum size",
      from: "From",
      smallLotsTitle: "Looking for a smaller entry point?",
      smallLotsDesc:
        "We also offer more compact lots between 690 and 1,300 m² — ideal for buyers who want an accessible starting point within the same project. These lots front a public road (no private entrance like the main block). The advantage: they're fully serviced and ready to build, with potable water and electricity already installed. Financing for these lots requires a 25% down payment.",
      smallLotsFeature1: "Lots from 690 to 1,300 m²",
      smallLotsFeature2: "Public road frontage",
      smallLotsFeature3: "Water and electricity installed",
      smallLotsFeature4: "Ready to build",
      smallLotsFeature5: "25% down payment for financing",
      smallLotsDownload: "Download complete information",
    },
  },
};
