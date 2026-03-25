import { Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";

export default function ContactSection() {
  const { t } = useLanguage();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://link.bralto.io/js/form_embed.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              {t("contact.title")}
            </h2>
            <p className="text-xl text-gray-600">{t("contact.subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-primary mb-6">
                  {t("contact.info")}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mr-4 flex-shrink-0">
                      <Phone className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {t("contact.phone")}
                      </p>
                      <p className="text-gray-600">+506 8414 2111</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mr-4 flex-shrink-0">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {t("contact.email")}
                      </p>
                      <p className="text-gray-600">
                        info@ecovivadesarrollos.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mr-4 flex-shrink-0">
                      <MapPin className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {t("contact.location")}
                      </p>
                      <p className="text-gray-600">
                        {t("contact.locationValue")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <iframe
                src="https://link.bralto.io/widget/form/OQnOy795eU8dHUfanbpB"
                style={{ width: '100%', height: '486px', border: 'none', borderRadius: '3px' }}
                id="inline-OQnOy795eU8dHUfanbpB"
                data-layout="{'id':'INLINE'}"
                data-trigger-type="alwaysShow"
                data-trigger-value=""
                data-activation-type="alwaysActivated"
                data-activation-value=""
                data-deactivation-type="neverDeactivate"
                data-deactivation-value=""
                data-form-name="Contact Us"
                data-height="486"
                data-layout-iframe-id="inline-OQnOy795eU8dHUfanbpB"
                data-form-id="OQnOy795eU8dHUfanbpB"
                title="Contact Us"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
