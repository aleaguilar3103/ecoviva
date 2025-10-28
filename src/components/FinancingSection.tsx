import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileCheck, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FinancingSectionProps {
  onContactClick?: () => void;
}

export default function FinancingSection({
  onContactClick = () => window.open("https://wa.link/6afpfu", "_blank"),
}: FinancingSectionProps) {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: DollarSign,
      title: t("financing.noPrima"),
      description: t("financing.noPrimaDesc"),
    },
    {
      icon: FileCheck,
      title: t("financing.noBanks"),
      description: t("financing.noBanksDesc"),
    },
    {
      icon: Clock,
      title: t("financing.immediate"),
      description: t("financing.immediateDesc"),
    },
  ];

  return (
    <section
      id="financing"
      className="py-20 bg-gradient-to-br from-primary to-primary/90"
    >
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t("financing.title")}
          </h2>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            {t("financing.subtitle")}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-5xl mx-auto">
          {benefits.map((benefit, index) => (
            <Card
              key={index}
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all"
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-white/80">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={onContactClick}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-white text-lg px-8 py-6"
          >
            {t("financing.cta")}
          </Button>
        </div>
      </div>
    </section>
  );
}
