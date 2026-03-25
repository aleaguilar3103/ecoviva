import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileCheck, BadgeCheck, TrendingUp, Shield, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, useRef } from "react";

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, suffix = "", prefix = "" }: { 
  end: number; 
  duration?: number; 
  suffix?: string; 
  prefix?: string;
}) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
};

interface FinancingSectionProps {
  onContactClick?: () => void;
}

export default function FinancingSection({
  onContactClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank"),
}: FinancingSectionProps) {
  const { t, language } = useLanguage();
  const [activeRequirement, setActiveRequirement] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Auto-rotate market conditions
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRequirement((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Track section visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const marketConditions = [
    { 
      icon: TrendingUp, 
      title: language === 'es' ? 'Tasas Competitivas' : 'Competitive Rates',
      description: language === 'es' ? 'Las mejores tasas de interés del mercado' : 'Best interest rates in the market'
    },
    { 
      icon: Shield, 
      title: language === 'es' ? 'Sin Prima Inicial' : 'No Down Payment',
      description: language === 'es' ? 'Empieza sin inversión inicial' : 'Start without initial investment'
    },
    { 
      icon: CheckCircle, 
      title: language === 'es' ? 'Sin Fiador' : 'No Co-signer',
      description: language === 'es' ? 'No necesitas garantías adicionales' : 'No additional guarantees needed'
    },
    { 
      icon: FileCheck, 
      title: language === 'es' ? 'Transparencia Total' : 'Full Transparency',
      description: language === 'es' ? 'Sin costos ocultos ni sorpresas' : 'No hidden costs or surprises'
    },
    { 
      icon: BadgeCheck, 
      title: language === 'es' ? 'Flexibilidad Total' : 'Total Flexibility',
      description: language === 'es' ? 'Plazos y cuotas a tu medida' : 'Terms and payments tailored to you'
    },
  ];

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
      icon: BadgeCheck,
      title: t("financing.requirements"),
      description: t("financing.requirementsDesc"),
    },
  ];

  const conditions = [
    {
      icon: TrendingUp,
      title: t("financing.bestRates"),
      description: t("financing.bestRatesDesc"),
    },
    {
      icon: Shield,
      title: t("financing.flexibility"),
      description: t("financing.flexibilityDesc"),
    },
    {
      icon: CheckCircle,
      title: t("financing.transparency"),
      description: t("financing.transparencyDesc"),
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="financing"
      className="relative py-24 bg-gradient-to-b from-white via-gray-50/50 to-white overflow-hidden"
    >
      {/* Subtle Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Animated Stats Banner */}
        <div className={`max-w-4xl mx-auto mb-16 transition-all duration-1000 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-accent mb-1">
                <AnimatedCounter end={100} suffix="%" />
              </div>
              <p className="text-xs md:text-sm text-primary/60">{language === 'es' ? 'Financiamiento Directo' : 'Direct Financing'}</p>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-3xl md:text-5xl font-bold text-primary mb-1">
                <AnimatedCounter end={0} prefix="$" />
              </div>
              <p className="text-xs md:text-sm text-primary/60">{language === 'es' ? 'Prima Inicial' : 'Down Payment'}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-accent mb-1">
                <AnimatedCounter end={15} suffix=" " />
                <span className="text-lg md:text-2xl">{language === 'es' ? 'años' : 'yrs'}</span>
              </div>
              <p className="text-xs md:text-sm text-primary/60">{language === 'es' ? 'Plazo Máximo' : 'Max Term'}</p>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 delay-200 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-block bg-accent/10 text-accent px-5 py-1.5 rounded-full text-sm font-medium mb-4">
            {t("financing.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            {t("financing.title")}
          </h2>
          <p className="text-base text-primary/60 max-w-xl mx-auto">
            {t("financing.subtitle")}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
          {/* Left: Benefits */}
          <div className={`space-y-4 transition-all duration-1000 delay-300 ${isInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
            <h3 className="text-lg font-semibold text-primary mb-6">{language === 'es' ? 'Beneficios del Programa' : 'Program Benefits'}</h3>
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="group flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-accent/30 hover:shadow-lg transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:scale-105 transition-all duration-500">
                  <benefit.icon className="w-6 h-6 text-accent group-hover:text-white transition-colors duration-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-1 group-hover:text-accent transition-colors duration-300">
                    {benefit.title}
                  </h4>
                  <p className="text-sm text-primary/60">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Interactive Market Conditions Card */}
          <div className={`transition-all duration-1000 delay-400 ${isInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
            <h3 className="text-lg font-semibold text-primary mb-6">{language === 'es' ? 'Las Mejores Condiciones' : 'Best Market Conditions'}</h3>
            <Card className="bg-gradient-to-br from-primary to-primary/90 text-white overflow-hidden">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <p className="text-white/70 text-sm mb-2">{language === 'es' ? 'Te ofrecemos' : 'We offer you'}</p>
                  <div className="text-4xl font-bold mb-2">{language === 'es' ? 'Lo Mejor' : 'The Best'}</div>
                  <p className="text-white/70">{language === 'es' ? 'del mercado' : 'in the market'}</p>
                </div>

                {/* Animated Market Conditions Switcher */}
                <div className="relative h-32 mb-6">
                  {marketConditions.map((condition, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-out ${
                        activeRequirement === index 
                          ? 'opacity-100 translate-y-0 scale-100' 
                          : 'opacity-0 translate-y-8 scale-95'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-3 backdrop-blur-sm">
                        <condition.icon className="w-8 h-8 text-white" />
                      </div>
                      <p className="font-semibold text-lg">{condition.title}</p>
                      <p className="text-sm text-white/70">{condition.description}</p>
                    </div>
                  ))}
                </div>

                {/* Progress Dots */}
                <div className="flex justify-center gap-2">
                  {marketConditions.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveRequirement(index)}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        activeRequirement === index 
                          ? 'w-8 bg-accent' 
                          : 'w-2 bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Simple Requirement */}
            <div className="mt-4 p-4 rounded-xl bg-accent/10 border border-accent/20 text-center">
              <p className="text-sm text-primary/70 mb-1">{language === 'es' ? 'Único requisito' : 'Only requirement'}</p>
              <p className="font-semibold text-primary">{language === 'es' ? 'Cédula de identidad + llenar formulario' : 'ID card + fill out form'}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`text-center transition-all duration-1000 delay-500 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <Button
            onClick={onContactClick}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-white text-base font-semibold px-10 py-6 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            {t("financing.cta")}
          </Button>
          <p className="text-primary/50 text-sm mt-4">
            {t("financing.ctaSubtext")}
          </p>
        </div>
      </div>
    </section>
  );
}
