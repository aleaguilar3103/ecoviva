import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Phone } from "lucide-react";

export default function FunnelDiscard() {
  const navigate = useNavigate();

  // If someone lands here without being discarded (e.g. direct URL), send them to the funnel
  useEffect(() => {
    if (localStorage.getItem("ecoviva_funnel_status") !== "discarded") {
      navigate("/funnel", { replace: true });
    }
  }, [navigate]);

  const handleWhatsApp = () => {
    window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">Eco Viva</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Illustration */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <span className="text-4xl">🌱</span>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Por el momento no tenemos el proyecto ideal para tu presupuesto
            </h1>
            <p className="text-gray-500 leading-relaxed">
              Nuestros proyectos actuales están diseñados para personas que
              invierten desde $500 mensuales. Si tu situación cambia en el
              futuro, con gusto te atendemos.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Optional WhatsApp CTA */}
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              ¿Tienes preguntas? Escríbenos directamente
            </p>
            <button
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold rounded-full transition-all duration-200 shadow-sm hover:shadow-md text-sm"
            >
              <Phone className="w-4 h-4" />
              Contactar por WhatsApp
            </button>
          </div>

          <p className="text-xs text-gray-300">
            Eco Viva Desarrollos · Costa Rica
          </p>
        </div>
      </main>
    </div>
  );
}
