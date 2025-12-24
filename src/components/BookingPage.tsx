import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectShowcase from "@/components/ProjectShowcase";
import FinancingCalculator from "@/components/FinancingCalculator";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, MapPin, Phone, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookingPage() {
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Load the booking widget script
    const script = document.createElement("script");
    script.src = "https://link.bralto.io/js/form_embed.js";
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleWhatsAppClick = () => {
    window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank");
  };

  const benefits = [
    "Recorrido personalizado por los proyectos",
    "Asesoría financiera sin compromiso",
    "Conoce las amenidades en persona",
    "Explora los lotes disponibles",
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg')] bg-cover bg-center opacity-20" />
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-6">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Agenda tu visita</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Conoce tu futuro hogar en Costa Rica
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              Agenda una visita guiada a nuestros proyectos y descubre por qué cientos de familias ya eligieron invertir con Eco Viva Desarrollos.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span>Zona Norte, Costa Rica</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Visitas disponibles todos los días</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                <span>+506 8414-2111</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Calendar Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
            {/* Benefits */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                  ¿Por qué agendar una visita?
                </h2>
                <p className="text-lg text-gray-600">
                  Una visita presencial te permite conocer de primera mano la calidad de nuestros desarrollos, las vistas impresionantes y el potencial de inversión.
                </p>
              </div>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
                  >
                    <CheckCircle className="w-6 h-6 text-accent flex-shrink-0" />
                    <span className="text-gray-700 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-6 rounded-xl border border-accent/20">
                <h3 className="text-xl font-bold text-primary mb-2">
                  ¿Prefieres contacto directo?
                </h3>
                <p className="text-gray-600 mb-4">
                  Nuestro equipo está disponible para atenderte por WhatsApp y coordinar tu visita de forma inmediata.
                </p>
                <Button
                  onClick={handleWhatsAppClick}
                  className="bg-accent hover:bg-accent/90 text-white"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Contactar por WhatsApp
                </Button>
              </div>
            </div>

            {/* Calendar Widget */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-primary p-6 text-white text-center">
                <Calendar className="w-10 h-10 mx-auto mb-3" />
                <h3 className="text-2xl font-bold">Selecciona fecha y hora</h3>
                <p className="text-white/80 mt-2">Elige el momento ideal para tu visita</p>
              </div>
              <div className="p-4">
                <iframe
                  src="https://link.bralto.io/widget/booking/3QOuxsC2g7z3y03vcY2a"
                  style={{ width: "100%", border: "none", overflow: "hidden", minHeight: "600px" }}
                  scrolling="no"
                  id="3QOuxsC2g7z3y03vcY2a_1766446810907"
                  title="Calendario de citas"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <ProjectShowcase />

      {/* Financing Calculator */}
      <FinancingCalculator />

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Listo para dar el siguiente paso?
          </h2>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">
            Agenda tu visita hoy y descubre por qué Costa Rica es el destino ideal para tu inversión en bienes raíces.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              size="lg"
              className="bg-white text-primary hover:bg-gray-100"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Agendar ahora
            </Button>
            <Button
              onClick={handleWhatsAppClick}
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <Phone className="w-5 h-5 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
