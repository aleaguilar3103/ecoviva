import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Leaf, Mountain, Droplets, TreePine, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ConfirmationPage() {
  const [timeLeft, setTimeLeft] = useState(15);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const content = {
    es: {
      badge: "Eco Viva Desarrollos",
      title: "¡Información Recibida!",
      subtitle: "Gracias por tu interés en nuestras propiedades en Costa Rica",
      message: "Un representante de Eco Viva se pondrá en contacto contigo muy pronto para brindarte toda la información que necesitas.",
      redirecting: "Redirigiendo en",
      seconds: "segundos",
      visitNow: "Visitar ahora",
    },
    en: {
      badge: "Eco Viva Desarrollos",
      title: "Information Received!",
      subtitle: "Thank you for your interest in our properties in Costa Rica",
      message: "An Eco Viva representative will contact you very soon to provide you with all the information you need.",
      redirecting: "Redirecting in",
      seconds: "seconds",
      visitNow: "Visit now",
    },
  };

  const t = content[language] || content.es;

  useEffect(() => {
    if (timeLeft <= 0) {
      window.location.href = "https://ecovivadesarrollos.com";
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleVisitNow = () => {
    window.location.href = "https://ecovivadesarrollos.com";
  };

  const progress = ((15 - timeLeft) / 15) * 100;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Tropical gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2540] via-[#0d3a5c] to-[#145a32]" />
      
      {/* Animated decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Floating leaves */}
        <div className="absolute top-20 left-10 text-green-400/20 animate-pulse">
          <Leaf className="w-24 h-24 rotate-45" />
        </div>
        <div className="absolute top-40 right-20 text-green-500/15 animate-pulse delay-300">
          <TreePine className="w-32 h-32" />
        </div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20 animate-pulse delay-500">
          <Mountain className="w-40 h-40" />
        </div>
        <div className="absolute bottom-20 right-10 text-cyan-400/15 animate-pulse delay-700">
          <Droplets className="w-28 h-28" />
        </div>
        
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl" />
      </div>

      <main className="flex-1 flex items-center justify-center relative z-10 px-4">
        <div className="max-w-2xl w-full">
          {/* Success card with glass morphism effect */}
          <div className="relative">
            {/* Card glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500 rounded-3xl blur-lg opacity-40 animate-pulse" />
            
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 border border-white/50 text-center">
              {/* Decorative top border */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />
              
              {/* Success icon */}
              <div className="mb-6">
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4">
                    <CheckCircle className="w-16 h-16 text-white" />
                  </div>
                </div>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-400/30 mb-6">
                <Leaf className="w-4 h-4 text-green-600" />
                <span className="text-green-700 text-sm font-medium">{t.badge}</span>
              </div>
              
              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#0a2540] via-green-700 to-emerald-600 bg-clip-text text-transparent">
                  {t.title}
                </span>
              </h1>
              
              {/* Subtitle */}
              <p className="text-lg md:text-xl text-gray-600 mb-6">
                {t.subtitle} 🌴
              </p>

              {/* Message */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-100">
                <p className="text-gray-700 leading-relaxed">
                  {t.message}
                </p>
              </div>

              {/* Timer section */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Clock className="w-5 h-5" />
                  <span>{t.redirecting}</span>
                </div>

                {/* Circular timer */}
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - progress / 100)}
                      className="transition-all duration-1000 ease-linear"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {timeLeft}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-400">{t.seconds}</p>

                {/* Visit now button */}
                <button
                  onClick={handleVisitNow}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-full hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  {t.visitNow}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
