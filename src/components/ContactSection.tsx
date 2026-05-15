import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useRef, useState } from "react";

export default function ContactSection() {
  const { t } = useLanguage();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://link.bralto.io/js/form_embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const contacts = [
    {
      Icon: MessageCircle,
      label: "WhatsApp",
      value: "+506 8414 2111",
      href: "https://api.whatsapp.com/send?phone=50684142111",
      color: "#25D366",
    },
    {
      Icon: Mail,
      label: t("contact.email"),
      value: "info@ecovivadesarrollos.com",
      href: "mailto:info@ecovivadesarrollos.com",
      color: "#74CE52",
    },
    {
      Icon: MapPin,
      label: t("contact.location"),
      value: t("contact.locationValue"),
      href: null,
      color: "#74CE52",
    },
  ];

  return (
    <section
      ref={ref}
      id="contact"
      className="relative py-24 overflow-hidden"
      style={{ backgroundColor: "#0d1410" }}
    >
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px] pointer-events-none" style={{ backgroundColor: "rgba(116,206,82,0.04)" }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <div
          className="text-center mb-14 transition-all duration-700"
          style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)" }}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}
          >
            Contáctanos
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t("contact.title")}</h2>
          <p className="text-white/45 text-lg">{t("contact.subtitle")}</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 max-w-5xl mx-auto">
          {/* Left info column */}
          <div
            className="lg:col-span-2 flex flex-col gap-4 transition-all duration-700"
            style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(-24px)", transitionDelay: "150ms" }}
          >
            <h3 className="text-lg font-semibold text-white mb-2">{t("contact.info")}</h3>

            {contacts.map(({ Icon, label, value, href, color }, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-300"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-0.5">{label}</p>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-white font-medium hover:underline transition-colors" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* WhatsApp CTA block */}
            <a
              href="https://api.whatsapp.com/send?phone=50684142111"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{ backgroundColor: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)" }}
            >
              <MessageCircle className="w-6 h-6 flex-shrink-0" style={{ color: "#25D366" }} />
              <div>
                <p className="text-sm font-semibold text-white">Escríbenos por WhatsApp</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Respuesta en minutos</p>
              </div>
            </a>
          </div>

          {/* Right: Form */}
          <div
            className="lg:col-span-3 transition-all duration-700"
            style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(24px)", transitionDelay: "250ms" }}
          >
            <div
              className="rounded-2xl overflow-hidden p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <iframe
                src="https://link.bralto.io/widget/form/OQnOy795eU8dHUfanbpB"
                style={{ width: "100%", height: "480px", border: "none" }}
                id="inline-OQnOy795eU8dHUfanbpB"
                data-layout="{'id':'INLINE'}"
                data-trigger-type="alwaysShow"
                data-trigger-value=""
                data-activation-type="alwaysActivated"
                data-activation-value=""
                data-deactivation-type="neverDeactivate"
                data-deactivation-value=""
                data-form-name="Contact Us"
                data-height="480"
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
