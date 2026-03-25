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
    t("booking.benefit1"),
    t("booking.benefit2"),
    t("booking.benefit3"),
    t("booking.benefit4"),
  ];

  return (
    <div className="min-h-screen bg-white overflow-y-auto" style={{ height: '100vh', overflowY: 'auto' }}>
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg')] bg-cover bg-center opacity-20" />
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-6">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">{t("booking.badge")}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t("booking.heroTitle")}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              {t("booking.heroSubtitle")}
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span>{t("booking.location")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{t("booking.available")}</span>
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
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Calendar Widget - Centered and Primary */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="bg-white rounded-2xl shadow-2xl border border-accent/20 overflow-hidden">
              <div className="bg-gradient-to-br from-primary to-primary/90 p-10 text-white text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10" />
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-3">{t("booking.selectDateTime")}</h2>
                <p className="text-white/90 text-xl leading-relaxed">{t("booking.selectDateTimeDesc")}</p>
              </div>
              <div className="p-6">
                <iframe
                  src="https://link.bralto.io/widget/booking/3QOuxsC2g7z3y03vcY2a"
                  style={{ width: "100%", border: "none", minHeight: "700px", height: "700px" }}
                  id="3QOuxsC2g7z3y03vcY2a_1769534048294"
                  title="Calendario de citas"
                />
              </div>
            </div>
          </div>

          {/* Benefits - Below Calendar */}
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                {t("booking.whySchedule")}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t("booking.whyScheduleDesc")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-sm border border-accent/20 hover:shadow-lg transition-shadow"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-accent" />
                  </div>
                  <span className="text-gray-700 font-medium text-lg">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-8 rounded-2xl border border-accent/20 text-center">
              <h3 className="text-2xl font-bold text-primary mb-3">
                {t("booking.preferDirect")}
              </h3>
              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                {t("booking.preferDirectDesc")}
              </p>
              <Button
                onClick={handleWhatsAppClick}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white px-8"
              >
                <Phone className="w-5 h-5 mr-2" />
                {t("booking.contactWhatsApp")}
              </Button>
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
            {t("booking.readyNext")}
          </h2>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">
            {t("booking.readyNextDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              size="lg"
              className="bg-white text-primary hover:bg-gray-100"
            >
              <Calendar className="w-5 h-5 mr-2" />
              {t("booking.scheduleNow")}
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
