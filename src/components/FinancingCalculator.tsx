import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FinancingCalculatorProps {
  onWhatsAppClick?: () => void;
}

export default function FinancingCalculator({
  onWhatsAppClick = () => window.open("https://wa.link/6afpfu", "_blank"),
}: FinancingCalculatorProps) {
  const { t } = useLanguage();
  const [lotValue, setLotValue] = useState("170000");
  const [term, setTerm] = useState("20");
  const annualRate = "9"; // Fixed rate at 9%
  const [monthlyPayment, setMonthlyPayment] = useState("1529.53");

  const calculatePayment = () => {
    const monto = parseFloat(lotValue);
    const plazo_anios = parseInt(term);
    const tasa_anual = parseFloat(annualRate) / 100;

    if (isNaN(monto) || isNaN(plazo_anios) || isNaN(tasa_anual)) {
      return;
    }

    const r = tasa_anual / 12;
    const n = plazo_anios * 12;

    const pago_mensual = (monto * r) / (1 - Math.pow(1 + r, -n));

    setMonthlyPayment(pago_mensual.toFixed(2));
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "$0";
    return (
      "$" +
      num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  return (
    <section id="calculadora-financiamiento" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Calculator className="w-10 h-10 text-accent mr-3" />
              <h2 className="text-3xl md:text-4xl font-bold text-primary">
                {t("calculator.title")}
              </h2>
            </div>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
              {t("calculator.subtitle")}
            </p>
          </div>

          {/* Calculator Card */}
          <Card className="bg-white shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column - Form */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary mb-4">
                    Datos del financiamiento
                  </h3>

                  {/* Lot Value */}
                  <div>
                    <label
                      htmlFor="lotValue"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      {t("calculator.lotValue")}
                    </label>
                    <Input
                      id="lotValue"
                      type="number"
                      value={lotValue}
                      onChange={(e) => setLotValue(e.target.value)}
                      placeholder="170000"
                      className="w-full"
                    />
                  </div>

                  {/* Term */}
                  <div>
                    <label
                      htmlFor="term"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      {t("calculator.term")}
                    </label>
                    <Select value={term} onValueChange={setTerm}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar plazo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 años</SelectItem>
                        <SelectItem value="10">10 años</SelectItem>
                        <SelectItem value="15">15 años</SelectItem>
                        <SelectItem value="20">20 años</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Annual Rate - Fixed Display */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      {t("calculator.rate")}
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-semibold">
                      9%
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <Button
                    onClick={calculatePayment}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    size="lg"
                  >
                    {t("calculator.calculate")}
                  </Button>
                </div>

                {/* Right Column - Result */}
                <div className="flex flex-col justify-center">
                  <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <p className="text-sm font-semibold text-gray-600 mb-2">
                          {t("calculator.monthlyPayment")}
                        </p>
                        <p className="text-4xl md:text-5xl font-bold text-primary">
                          {formatCurrency(monthlyPayment)}
                          <span className="text-xl text-gray-600"> / mes</span>
                        </p>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-6">
                        <p>
                          <span className="font-semibold">
                            {t("calculator.totalPayment")}:
                          </span>{" "}
                          {formatCurrency(lotValue)}
                        </p>
                        <p>
                          <span className="font-semibold">
                            Prima requerida:
                          </span>{" "}
                          $0
                        </p>
                        <p className="text-xs mt-4 text-gray-500">
                          Aprobación inmediata. Sin fiador. Sin estudio
                          crediticio.
                          <br />
                          Sujeto a disponibilidad del proyecto.
                        </p>
                      </div>

                      <Button
                        onClick={onWhatsAppClick}
                        className="w-full bg-accent hover:bg-accent/90 text-white"
                        size="lg"
                      >
                        Quiero este financiamiento →
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}