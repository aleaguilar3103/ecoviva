import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContactSectionProps {
  onSubmit?: (data: {
    name: string;
    email: string;
    phone: string;
    message: string;
  }) => void;
}

export default function ContactSection({
  onSubmit = (data) => console.log("Contact form submitted:", data),
}: ContactSectionProps) {
  const { t } = useLanguage();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      message: formData.get("message") as string,
    });
  };

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
                      <p className="text-gray-600">+506 7157 4334</p>
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
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {t("contact.form.name")}
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder={t("contact.form.namePlaceholder")}
                    className="w-full"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {t("contact.form.email")}
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder={t("contact.form.emailPlaceholder")}
                    className="w-full"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {t("contact.form.phone")}
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder={t("contact.form.phonePlaceholder")}
                    className="w-full"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {t("contact.form.message")}
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    placeholder={t("contact.form.messagePlaceholder")}
                    className="w-full min-h-[120px]"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  {t("contact.form.submit")}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
