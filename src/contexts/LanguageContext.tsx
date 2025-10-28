import { createContext, useContext, useState, ReactNode } from "react";

type LanguageCode = "es" | "en" | "fr" | "de" | "pt" | "it";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>("es");

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
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
      subtitle: "Financiamiento Con Aprobación Inmediata Sin Prima Ni Fiador.",
      description1:
        "Creamos proyectos sostenibles, con alto potencial de crecimiento.",
      financing:
        "💰 Financiamos al 100% — sin prima, sin fiador y sin estudio crediticio.",
      description2:
        "Impulsamos inversiones seguras y proyectos que transforman la región.",
      cta: "Nuestros Proyectos",
    },
    projects: {
      title: "Nuestros Proyectos",
      subtitle:
        "Inversiones únicas en las zonas más privilegiadas del norte de Costa Rica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Parque Nacional Volcán Tenorio",
        price: "$170,000 USD",
        size: "5,000 m² ($34/m²)",
        features: [
          "Acceso directo al río",
          "Privacidad total",
          "Potencial extraordinario para Airbnb, glamping o finca de retiro",
        ],
        badges: ["Disponible", "Acceso al Río"],
        description:
          "Dentro del área del Parque Nacional Volcán Tenorio, el Río Celeste es famoso por su color turquesa único en el mundo. En este proyecto, cada quinta ofrece 5.000 m² por $170.000 USD, es decir, $34 por m², con acceso directo al río, privacidad total y un potencial extraordinario para Airbnb, glamping o finca de retiro.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Consultar",
        size: "Varios tamaños disponibles",
        features: [
          "Vistas panorámicas a Ciudad Quesada y Volcán Arenal",
          "Clima fresco de montaña",
          "Ideal para residencia premium o desarrollo turístico",
        ],
        badges: ["Premium", "Vista al Volcán"],
        description:
          "Ubicado en una zona alta con clima fresco y vistas amplias a toda Ciudad Quesada y al Volcán Arenal. Ideal para residencia premium o desarrollo turístico de cabañas boutique, con cercanía a servicios y vías principales.",
      },
      financingDetails: [
        "Financiamiento al 100% sin prima",
        "Sin fiador ni estudio crediticio",
        "Aprobación inmediata",
        "Mejores condiciones del mercado",
      ],
    },
    calculator: {
      title: "Calculadora de Financiamiento",
      subtitle:
        "Calcula tu cuota mensual y descubre lo accesible que es invertir en tu propiedad",
      lotValue: "Valor del Lote (USD)",
      term: "Plazo (años)",
      rate: "Tasa Anual (%)",
      calculate: "Calcular",
      monthlyPayment: "Cuota Mensual",
      totalPayment: "Pago Total",
      totalInterest: "Intereses Totales",
    },
    financing: {
      title: "Financiamiento Real",
      subtitle:
        "Sin prima, sin bancos, sin fiador y con aprobación inmediata. Elegís el lote, activamos el plan y empezás a invertir sin trámites bancarios ni papeleo eterno.",
      noPrima: "Sin Prima",
      noPrimaDesc: "Comienza tu inversión sin necesidad de pago inicial",
      noBanks: "Sin Bancos, Sin Fiador",
      noBanksDesc:
        "Aprobación inmediata sin trámites bancarios ni papeleo eterno",
      immediate: "Aprobación Inmediata",
      immediateDesc: "Elegís el lote, activamos el plan y empezás a invertir",
      cta: "Quiero mi aprobación",
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
  },
  en: {
    header: {
      inicio: "Home",
      proyectos: "Projects",
      calculadora: "Financing Calculator",
      financiamiento: "Financing",
      contacto: "Contact",
      hablarAhora: "Talk Now",
    },
    hero: {
      title:
        "Real Estate Projects in the best locations of Northern Costa Rica.",
      subtitle:
        "Financing With Immediate Approval Without Down Payment or Guarantor.",
      description1:
        "We create sustainable projects with high growth potential.",
      financing:
        "💰 100% financing — no down payment, no guarantor, and no credit check.",
      description2:
        "We promote safe investments and projects that transform the region.",
      cta: "Our Projects",
    },
    projects: {
      title: "Our Projects",
      subtitle:
        "Unique investments in the most privileged areas of northern Costa Rica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Tenorio Volcano National Park",
        price: "$170,000 USD",
        size: "5,000 m² ($34/m²)",
        features: [
          "Direct river access",
          "Total privacy",
          "Extraordinary potential for Airbnb, glamping or retreat farm",
        ],
        badges: ["Available", "River Access"],
        description:
          "Within the Tenorio Volcano National Park area, Rio Celeste is famous for its unique turquoise color in the world. In this project, each quinta offers 5,000 m² for $170,000 USD, that is, $34 per m², with direct river access, total privacy and extraordinary potential for Airbnb, glamping or retreat farm.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Inquire",
        size: "Various sizes available",
        features: [
          "Panoramic views of Ciudad Quesada and Arenal Volcano",
          "Cool mountain climate",
          "Ideal for premium residence or tourist development",
        ],
        badges: ["Premium", "Volcano View"],
        description:
          "Located in a high area with cool climate and wide views of all Ciudad Quesada and Arenal Volcano. Ideal for premium residence or boutique cabin tourist development, with proximity to services and main roads.",
      },
      financingDetails: [
        "100% financing without down payment",
        "No guarantor or credit check",
        "Immediate approval",
        "Best market conditions",
      ],
    },
    calculator: {
      title: "Financing Calculator",
      subtitle:
        "Calculate your monthly payment and discover how affordable it is to invest in your property",
      lotValue: "Lot Value (USD)",
      term: "Term (years)",
      rate: "Annual Rate (%)",
      calculate: "Calculate",
      monthlyPayment: "Monthly Payment",
      totalPayment: "Total Payment",
      totalInterest: "Total Interest",
    },
    financing: {
      title: "Real Financing",
      subtitle:
        "No down payment, no banks, no guarantor and with immediate approval. You choose the lot, we activate the plan and you start investing without bank procedures or endless paperwork.",
      noPrima: "No Down Payment",
      noPrimaDesc:
        "Start your investment without the need for an initial payment",
      noBanks: "No Banks, No Guarantor",
      noBanksDesc:
        "Immediate approval without bank procedures or endless paperwork",
      immediate: "Immediate Approval",
      immediateDesc:
        "You choose the lot, we activate the plan and you start investing",
      cta: "I want my approval",
    },
    contact: {
      title: "Contact Us",
      subtitle: "We are here to answer all your questions",
      info: "Contact Information",
      phone: "Phone",
      email: "Email",
      location: "Location",
      locationValue: "Northern Costa Rica",
      form: {
        name: "Full Name",
        namePlaceholder: "Your name",
        email: "Email",
        emailPlaceholder: "your@email.com",
        phone: "Phone",
        phonePlaceholder: "+506 1234 5678",
        message: "Message",
        messagePlaceholder: "How can we help you?",
        submit: "Send Message",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Luxury developments in harmony with Costa Rican nature",
      quickLinks: "Quick Links",
      inicio: "Home",
      proyectos: "Projects",
      financiamiento: "Financing",
      contacto: "Contact",
      contactTitle: "Contact",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. All rights reserved.",
    },
  },
  fr: {
    header: {
      inicio: "Accueil",
      proyectos: "Projets",
      calculadora: "Calculateur de financement",
      financiamiento: "Financement",
      contacto: "Contact",
      hablarAhora: "Parler maintenant",
    },
    hero: {
      title:
        "Projets immobiliers dans les meilleurs emplacements du nord du Costa Rica.",
      subtitle:
        "Financement Avec Approbation Immédiate Sans Acompte Ni Garant.",
      description1:
        "Nous créons des projets durables avec un fort potentiel de croissance.",
      financing:
        "💰 Financement à 100% — sans acompte, sans garant et sans vérification de crédit.",
      description2:
        "Nous promouvons des investissements sûrs et des projets qui transforment la région.",
      cta: "Nos Projets",
    },
    projects: {
      title: "Nos Projets",
      subtitle:
        "Investissements uniques dans les zones les plus privilégiées du nord du Costa Rica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Parc National du Volcan Tenorio",
        price: "170 000 $ USD",
        size: "5 000 m² (34 $/m²)",
        features: [
          "Accès direct à la rivière",
          "Intimité totale",
          "Potentiel extraordinaire pour Airbnb, glamping ou ferme de retraite",
        ],
        badges: ["Disponible", "Accès à la rivière"],
        description:
          "Dans la zone du Parc National du Volcan Tenorio, le Rio Celeste est célèbre pour sa couleur turquoise unique au monde. Dans ce projet, chaque quinta offre 5 000 m² pour 170 000 $ USD, soit 34 $ par m², avec accès direct à la rivière, intimité totale et un potentiel extraordinaire pour Airbnb, glamping ou ferme de retraite.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Consulter",
        size: "Différentes tailles disponibles",
        features: [
          "Vues panoramiques sur Ciudad Quesada et le volcan Arenal",
          "Climat frais de montagne",
          "Idéal pour résidence premium ou développement touristique",
        ],
        badges: ["Premium", "Vue sur le volcan"],
        description:
          "Situé dans une zone élevée avec un climat frais et de larges vues sur toute Ciudad Quesada et le volcan Arenal. Idéal pour une résidence premium ou un développement touristique de cabanes boutique, à proximité des services et des routes principales.",
      },
      financingDetails: [
        "Financement à 100% sans acompte",
        "Sans garant ni vérification de crédit",
        "Approbation immédiate",
        "Meilleures conditions du marché",
      ],
    },
    calculator: {
      title: "Calculateur de financement",
      subtitle:
        "Calculez votre paiement mensuel et découvrez à quel point il est abordable d'investir dans votre propriété",
      lotValue: "Valeur du lot (USD)",
      term: "Durée (années)",
      rate: "Taux annuel (%)",
      calculate: "Calculer",
      monthlyPayment: "Paiement mensuel",
      totalPayment: "Paiement total",
      totalInterest: "Intérêts totaux",
    },
    financing: {
      title: "Financement réel",
      subtitle:
        "Sans acompte, sans banques, sans garant et avec approbation immédiate. Vous choisissez le lot, nous activons le plan et vous commencez à investir sans procédures bancaires ni paperasse interminable.",
      noPrima: "Sans acompte",
      noPrimaDesc:
        "Commencez votre investissement sans besoin de paiement initial",
      noBanks: "Sans banques, sans garant",
      noBanksDesc:
        "Approbation immédiate sans procédures bancaires ni paperasse interminable",
      immediate: "Approbation immédiate",
      immediateDesc:
        "Vous choisissez le lot, nous activons le plan et vous commencez à investir",
      cta: "Je veux mon approbation",
    },
    contact: {
      title: "Contactez-nous",
      subtitle: "Nous sommes là pour répondre à toutes vos questions",
      info: "Informations de contact",
      phone: "Téléphone",
      email: "Email",
      location: "Emplacement",
      locationValue: "Nord du Costa Rica",
      form: {
        name: "Nom complet",
        namePlaceholder: "Votre nom",
        email: "Email",
        emailPlaceholder: "votre@email.com",
        phone: "Téléphone",
        phonePlaceholder: "+506 1234 5678",
        message: "Message",
        messagePlaceholder: "Comment pouvons-nous vous aider?",
        submit: "Envoyer le message",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Développements de luxe en harmonie avec la nature costaricaine",
      quickLinks: "Liens rapides",
      inicio: "Accueil",
      proyectos: "Projets",
      financiamiento: "Financement",
      contacto: "Contact",
      contactTitle: "Contact",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. Tous droits réservés.",
    },
  },
  de: {
    header: {
      inicio: "Startseite",
      proyectos: "Projekte",
      calculadora: "Finanzierungsrechner",
      financiamiento: "Finanzierung",
      contacto: "Kontakt",
      hablarAhora: "Jetzt sprechen",
    },
    hero: {
      title:
        "Immobilienprojekte an den besten Standorten im Norden Costa Ricas.",
      subtitle:
        "Finanzierung Mit Sofortiger Genehmigung Ohne Anzahlung Oder Bürge.",
      description1:
        "Wir schaffen nachhaltige Projekte mit hohem Wachstumspotenzial.",
      financing:
        "💰 100% Finanzierung — keine Anzahlung, kein Bürge und keine Bonitätsprüfung.",
      description2:
        "Wir fördern sichere Investitionen und Projekte, die die Region transformieren.",
      cta: "Unsere Projekte",
    },
    projects: {
      title: "Unsere Projekte",
      subtitle:
        "Einzigartige Investitionen in den privilegiertesten Gebieten Nordcostarica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Tenorio Vulkan Nationalpark",
        price: "170.000 $ USD",
        size: "5.000 m² (34 $/m²)",
        features: [
          "Direkter Flusszugang",
          "Absolute Privatsphäre",
          "Außergewöhnliches Potenzial für Airbnb, Glamping oder Rückzugsfarm",
        ],
        badges: ["Verfügbar", "Flusszugang"],
        description:
          "Im Gebiet des Tenorio Vulkan Nationalparks ist der Rio Celeste berühmt für seine weltweit einzigartige türkisfarbene Farbe. In diesem Projekt bietet jede Quinta 5.000 m² für 170.000 $ USD, das sind 34 $ pro m², mit direktem Flusszugang, absoluter Privatsphäre und außergewöhnlichem Potenzial für Airbnb, Glamping oder Rückzugsfarm.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Anfragen",
        size: "Verschiedene Größen verfügbar",
        features: [
          "Panoramablick auf Ciudad Quesada und Arenal Vulkan",
          "Kühles Bergklima",
          "Ideal für Premium-Residenz oder touristische Entwicklung",
        ],
        badges: ["Premium", "Vulkanblick"],
        description:
          "In einem hochgelegenen Gebiet mit kühlem Klima und weitem Blick auf ganz Ciudad Quesada und den Arenal Vulkan gelegen. Ideal für Premium-Residenz oder Boutique-Hütten-Tourismusentwicklung, in der Nähe von Dienstleistungen und Hauptstraßen.",
      },
      financingDetails: [
        "100% Finanzierung ohne Anzahlung",
        "Kein Bürge oder Bonitätsprüfung",
        "Sofortige Genehmigung",
        "Beste Marktbedingungen",
      ],
    },
    calculator: {
      title: "Finanzierungsrechner",
      subtitle:
        "Berechnen Sie Ihre monatliche Zahlung und entdecken Sie, wie erschwinglich es ist, in Ihre Immobilie zu investieren",
      lotValue: "Grundstückswert (USD)",
      term: "Laufzeit (Jahre)",
      rate: "Jahreszins (%)",
      calculate: "Berechnen",
      monthlyPayment: "Monatliche Zahlung",
      totalPayment: "Gesamtzahlung",
      totalInterest: "Gesamtzinsen",
    },
    financing: {
      title: "Echte Finanzierung",
      subtitle:
        "Keine Anzahlung, keine Banken, kein Bürge und mit sofortiger Genehmigung. Sie wählen das Grundstück, wir aktivieren den Plan und Sie beginnen zu investieren ohne Bankverfahren oder endlosen Papierkram.",
      noPrima: "Keine Anzahlung",
      noPrimaDesc:
        "Beginnen Sie Ihre Investition ohne Bedarf einer Anfangszahlung",
      noBanks: "Keine Banken, kein Bürge",
      noBanksDesc:
        "Sofortige Genehmigung ohne Bankverfahren oder endlosen Papierkram",
      immediate: "Sofortige Genehmigung",
      immediateDesc:
        "Sie wählen das Grundstück, wir aktivieren den Plan und Sie beginnen zu investieren",
      cta: "Ich möchte meine Genehmigung",
    },
    contact: {
      title: "Kontaktieren Sie uns",
      subtitle: "Wir sind hier, um alle Ihre Fragen zu beantworten",
      info: "Kontaktinformationen",
      phone: "Telefon",
      email: "E-Mail",
      location: "Standort",
      locationValue: "Nordcosta Rica",
      form: {
        name: "Vollständiger Name",
        namePlaceholder: "Ihr Name",
        email: "E-Mail",
        emailPlaceholder: "ihre@email.com",
        phone: "Telefon",
        phonePlaceholder: "+506 1234 5678",
        message: "Nachricht",
        messagePlaceholder: "Wie können wir Ihnen helfen?",
        submit: "Nachricht senden",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Luxusentwicklungen im Einklang mit der costaricanischen Natur",
      quickLinks: "Schnelllinks",
      inicio: "Startseite",
      proyectos: "Projekte",
      financiamiento: "Finanzierung",
      contacto: "Kontakt",
      contactTitle: "Kontakt",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. Alle Rechte vorbehalten.",
    },
  },
  pt: {
    header: {
      inicio: "Início",
      proyectos: "Projetos",
      calculadora: "Calculadora de financiamento",
      financiamiento: "Financiamento",
      contacto: "Contato",
      hablarAhora: "Falar agora",
    },
    hero: {
      title:
        "Projetos Imobiliários nas melhores localizações da Zona Norte da Costa Rica.",
      subtitle: "Financiamento Com Aprovação Imediata Sem Entrada Nem Fiador.",
      description1:
        "Criamos projetos sustentáveis com alto potencial de crescimento.",
      financing:
        "💰 Financiamento de 100% — sem entrada, sem fiador e sem verificação de crédito.",
      description2:
        "Promovemos investimentos seguros e projetos que transformam a região.",
      cta: "Nossos Projetos",
    },
    projects: {
      title: "Nossos Projetos",
      subtitle:
        "Investimentos únicos nas áreas mais privilegiadas do norte da Costa Rica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Parque Nacional Vulcão Tenorio",
        price: "$ 170.000 USD",
        size: "5.000 m² ($ 34/m²)",
        features: [
          "Acesso direto ao rio",
          "Privacidade total",
          "Potencial extraordinário para Airbnb, glamping ou fazenda de retiro",
        ],
        badges: ["Disponível", "Acesso ao rio"],
        description:
          "Dentro da área do Parque Nacional Vulcão Tenorio, o Rio Celeste é famoso por sua cor turquesa única no mundo. Neste projeto, cada quinta oferece 5.000 m² por $ 170.000 USD, ou seja, $ 34 por m², com acesso direto ao rio, privacidade total e potencial extraordinário para Airbnb, glamping ou fazenda de retiro.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Consultar",
        size: "Vários tamanhos disponíveis",
        features: [
          "Vistas panorâmicas de Ciudad Quesada e Vulcão Arenal",
          "Clima fresco de montanha",
          "Ideal para residência premium ou desenvolvimento turístico",
        ],
        badges: ["Premium", "Vista para o vulcão"],
        description:
          "Localizado em uma área alta com clima fresco e vistas amplas de toda Ciudad Quesada e do Vulcão Arenal. Ideal para residência premium ou desenvolvimento turístico de cabanas boutique, com proximidade a serviços e vias principais.",
      },
      financingDetails: [
        "Financiamento de 100% sem entrada",
        "Sem fiador ou verificação de crédito",
        "Aprovação imediata",
        "Melhores condições do mercado",
      ],
    },
    calculator: {
      title: "Calculadora de financiamento",
      subtitle:
        "Calcule seu pagamento mensal e descubra o quão acessível é investir em sua propriedade",
      lotValue: "Valor do lote (USD)",
      term: "Prazo (anos)",
      rate: "Taxa anual (%)",
      calculate: "Calcular",
      monthlyPayment: "Pagamento mensal",
      totalPayment: "Pagamento total",
      totalInterest: "Juros totais",
    },
    financing: {
      title: "Financiamento real",
      subtitle:
        "Sem entrada, sem bancos, sem fiador e com aprovação imediata. Você escolhe o lote, ativamos o plano e você começa a investir sem procedimentos bancários ou papelada interminável.",
      noPrima: "Sem entrada",
      noPrimaDesc:
        "Comece seu investimento sem necessidade de pagamento inicial",
      noBanks: "Sem bancos, sem fiador",
      noBanksDesc:
        "Aprovação imediata sem procedimentos bancários ou papelada interminável",
      immediate: "Aprovação imediata",
      immediateDesc:
        "Você escolhe o lote, ativamos o plano e você começa a investir",
      cta: "Quero minha aprovação",
    },
    contact: {
      title: "Entre em contato",
      subtitle: "Estamos aqui para responder todas as suas perguntas",
      info: "Informações de contato",
      phone: "Telefone",
      email: "E-mail",
      location: "Localização",
      locationValue: "Norte da Costa Rica",
      form: {
        name: "Nome completo",
        namePlaceholder: "Seu nome",
        email: "E-mail",
        emailPlaceholder: "seu@email.com",
        phone: "Telefone",
        phonePlaceholder: "+506 1234 5678",
        message: "Mensagem",
        messagePlaceholder: "Como podemos ajudá-lo?",
        submit: "Enviar mensagem",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline:
        "Desenvolvimentos de luxo em harmonia com a natureza costarriquenha",
      quickLinks: "Links rápidos",
      inicio: "Início",
      proyectos: "Projetos",
      financiamiento: "Financiamento",
      contacto: "Contato",
      contactTitle: "Contato",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. Todos os direitos reservados.",
    },
  },
  it: {
    header: {
      inicio: "Home",
      proyectos: "Progetti",
      calculadora: "Calcolatore di finanziamento",
      financiamiento: "Finanziamento",
      contacto: "Contatto",
      hablarAhora: "Parla ora",
    },
    hero: {
      title:
        "Progetti Immobiliari nelle migliori località della Zona Nord della Costa Rica.",
      subtitle:
        "Finanziamento Con Approvazione Immediata Senza Acconto Né Garante.",
      description1:
        "Creiamo progetti sostenibili con alto potenziale di crescita.",
      financing:
        "💰 Finanziamento al 100% — senza acconto, senza garante e senza controllo del credito.",
      description2:
        "Promuoviamo investimenti sicuri e progetti che trasformano la regione.",
      cta: "I Nostri Progetti",
    },
    projects: {
      title: "I nostri progetti",
      subtitle:
        "Investimenti unici nelle aree più privilegiate del nord della Costa Rica",
      rioCeleste: {
        title: "Rio Celeste Oasis",
        location: "Parco Nazionale Vulcano Tenorio",
        price: "$ 170.000 USD",
        size: "5.000 m² ($ 34/m²)",
        features: [
          "Accesso diretto al fiume",
          "Privacy totale",
          "Potenziale straordinario per Airbnb, glamping o fattoria di ritiro",
        ],
        badges: ["Disponibile", "Accesso al fiume"],
        description:
          "All'interno dell'area del Parco Nazionale Vulcano Tenorio, il Rio Celeste è famoso per il suo colore turchese unico al mondo. In questo progetto, ogni quinta offre 5.000 m² per $ 170.000 USD, ovvero $ 34 per m², con accesso diretto al fiume, privacy totale e potenziale straordinario per Airbnb, glamping o fattoria di ritiro.",
      },
      llanadaViews: {
        title: "Lomas De La Llanada",
        location: "Ciudad Quesada",
        price: "Consultare",
        size: "Varie dimensioni disponibili",
        features: [
          "Viste panoramiche su Ciudad Quesada e Vulcano Arenal",
          "Clima fresco di montagna",
          "Ideale per residenza premium o sviluppo turistico",
        ],
        badges: ["Premium", "Vista sul vulcano"],
        description:
          "Situato in una zona alta con clima fresco e ampie viste su tutta Ciudad Quesada e sul Vulcano Arenal. Ideale per residenza premium o sviluppo turistico di cabine boutique, con vicinanza a servizi e strade principali.",
      },
      financingDetails: [
        "Finanziamento al 100% senza acconto",
        "Senza garante o controllo del credito",
        "Approvazione immediata",
        "Migliori condizioni di mercato",
      ],
    },
    calculator: {
      title: "Calcolatore di finanziamento",
      subtitle:
        "Calcola il tuo pagamento mensile e scopri quanto è accessibile investire nella tua proprietà",
      lotValue: "Valore del lotto (USD)",
      term: "Termine (anni)",
      rate: "Tasso annuale (%)",
      calculate: "Calcola",
      monthlyPayment: "Pagamento mensile",
      totalPayment: "Pagamento totale",
      totalInterest: "Interessi totali",
    },
    financing: {
      title: "Finanziamento reale",
      subtitle:
        "Senza acconto, senza banche, senza garante e con approvazione immediata. Scegli il lotto, attiviamo il piano e inizi a investire senza procedure bancarie o scartoffie infinite.",
      noPrima: "Senza acconto",
      noPrimaDesc:
        "Inizia il tuo investimento senza bisogno di pagamento iniziale",
      noBanks: "Senza banche, senza garante",
      noBanksDesc:
        "Approvazione immediata senza procedure bancarie o scartoffie infinite",
      immediate: "Approvazione immediata",
      immediateDesc: "Scegli il lotto, attiviamo il piano e inizi a investire",
      cta: "Voglio la mia approvazione",
    },
    contact: {
      title: "Contattaci",
      subtitle: "Siamo qui per rispondere a tutte le tue domande",
      info: "Informazioni di contatto",
      phone: "Telefono",
      email: "Email",
      location: "Posizione",
      locationValue: "Nord della Costa Rica",
      form: {
        name: "Nome completo",
        namePlaceholder: "Il tuo nome",
        email: "Email",
        emailPlaceholder: "tua@email.com",
        phone: "Telefono",
        phonePlaceholder: "+506 1234 5678",
        message: "Messaggio",
        messagePlaceholder: "Come possiamo aiutarti?",
        submit: "Invia messaggio",
      },
    },
    footer: {
      brand: "Eco Viva",
      brandAccent: "Desarrollos",
      tagline: "Sviluppi di lusso in armonia con la natura costaricana",
      quickLinks: "Link rapidi",
      inicio: "Home",
      proyectos: "Progetti",
      financiamiento: "Finanziamento",
      contacto: "Contatto",
      contactTitle: "Contatto",
      whatsapp: "WhatsApp",
      copyright: "© 2025 Eco Viva Desarrollos. Tutti i diritti riservati.",
    },
  },
};
