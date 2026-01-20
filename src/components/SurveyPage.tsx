import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SurveyPage() {
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Load the survey widget script
    const script = document.createElement("script");
    script.src = "https://link.bralto.io/js/form_embed.js";
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      // Clean up script on unmount
      const existingScript = document.querySelector(
        'script[src="https://link.bralto.io/js/form_embed.js"]'
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-16 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                {t("survey.title")}
              </h1>
              <p className="text-lg text-gray-600">
                {t("survey.subtitle")}
              </p>
            </div>

            {/* Survey Embed */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <iframe
                src="https://link.bralto.io/widget/survey/Mhrt7jgZ2Hd8EGxPWkDZ"
                style={{ border: "none", width: "100%", minHeight: "600px" }}
                scrolling="no"
                id="Mhrt7jgZ2Hd8EGxPWkDZ"
                title="survey"
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
