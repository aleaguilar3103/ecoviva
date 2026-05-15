import { useState, useEffect } from "react";
import { Calculator, MessageCircle, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FinancingCalculatorProps {
  onWhatsAppClick?: () => void;
}

export default function FinancingCalculator({
  onWhatsAppClick = () => window.open("https://api.whatsapp.com/send?phone=50684142111", "_blank"),
}: FinancingCalculatorProps) {
  const { t } = useLanguage();
  const [currency, setCurrency] = useState<"USD" | "CRC">("USD");
  const [lotValue, setLotValue] = useState("150000");
  const [term, setTerm] = useState("20");
  const [monthlyPayment, setMonthlyPayment] = useState("1529.53");

  // Interest rate: USD = 9%, CRC = 8%
  const annualRate = currency === "USD" ? 9 : 8;

  const calculatePayment = () => {
    const monto = parseFloat(lotValue);
    const plazo_anios = parseInt(term);
    const tasa_anual = annualRate / 100;
    if (isNaN(monto) || isNaN(plazo_anios) || isNaN(tasa_anual)) return;
    const r = tasa_anual / 12;
    const n = plazo_anios * 12;
    const pago_mensual = (monto * r) / (1 - Math.pow(1 + r, -n));
    setMonthlyPayment(pago_mensual.toFixed(2));
  };

  useEffect(() => { calculatePayment(); }, [currency, lotValue, term]);

  const fmtCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return currency === "USD" ? "$0" : "₡0";
    if (currency === "USD") return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return "₡" + num.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: "0.9rem",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "8px",
    color: "rgba(255,255,255,0.45)",
  };

  return (
    <section id="calculadora-financiamiento" className="py-24 relative overflow-hidden" style={{ backgroundColor: "#0a0f0b" }}>
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "rgba(116,206,82,0.04)" }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(116,206,82,0.1)", color: "#74CE52", border: "1px solid rgba(116,206,82,0.2)" }}>
            Herramienta
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <Calculator className="w-8 h-8" style={{ color: "#74CE52" }} />
            {t("calculator.title")}
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
            {t("calculator.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="grid md:grid-cols-2">
            {/* Left – inputs */}
            <div className="p-8 md:p-10" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-base font-semibold text-white mb-7">{t("calculator.financingData")}</h3>

              {/* Currency toggle */}
              <div className="mb-6">
                <span style={labelStyle}>{t("calculator.currency")}</span>
                <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                  {(["USD", "CRC"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200"
                      style={{
                        backgroundColor: currency === c ? "#74CE52" : "transparent",
                        color: currency === c ? "#0d1a10" : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {c === "USD" ? "USD ($)" : "CRC (₡)"}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {currency === "USD" ? t("calculator.rateUSD") : t("calculator.rateCRC")}
                </p>
              </div>

              {/* Lot value */}
              <div className="mb-5">
                <label style={labelStyle}>
                  {currency === "USD" ? t("calculator.lotValue") : t("calculator.lotValueCRC")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: "#74CE52" }}>
                    {currency === "USD" ? "$" : "₡"}
                  </span>
                  <input
                    type="number"
                    value={lotValue}
                    onChange={e => setLotValue(e.target.value)}
                    placeholder={currency === "USD" ? "150000" : "85000000"}
                    style={{ ...inputStyle, paddingLeft: "32px" }}
                    onFocus={e => (e.target.style.borderColor = "rgba(116,206,82,0.4)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>
              </div>

              {/* Term */}
              <div className="mb-5">
                <label style={labelStyle}>{t("calculator.term")}</label>
                <div className="relative">
                  <select
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    style={{ ...inputStyle, appearance: "none", paddingRight: "36px", cursor: "pointer" }}
                  >
                    {["5", "10", "15", "20"].map(y => (
                      <option key={y} value={y} style={{ backgroundColor: "#111a14", color: "white" }}>
                        {y} {t("calculator.years")}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
              </div>

              {/* Rate – fixed display */}
              <div className="mb-7">
                <label style={labelStyle}>{t("calculator.rate")}</label>
                <div className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ backgroundColor: "rgba(116,206,82,0.08)", border: "1px solid rgba(116,206,82,0.2)", color: "#74CE52" }}>
                  {annualRate}% anual
                </div>
              </div>

              <button
                onClick={calculatePayment}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                style={{ backgroundColor: "#74CE52", color: "#0d1a10" }}
              >
                {t("calculator.calculate")}
              </button>
            </div>

            {/* Right – result */}
            <div className="p-8 md:p-10 flex flex-col justify-between" style={{ backgroundColor: "rgba(116,206,82,0.03)" }}>
              <div>
                <h3 className="text-base font-semibold text-white mb-7">{t("calculator.monthlyPayment")}</h3>

                {/* Big payment number */}
                <div className="mb-8">
                  <div className="text-4xl md:text-5xl font-bold leading-tight" style={{ color: "#74CE52" }}>
                    {fmtCurrency(monthlyPayment)}
                  </div>
                  <div className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    / {t("calculator.perMonth")}
                  </div>
                </div>

                {/* Details rows */}
                <div className="space-y-3 mb-8">
                  {[
                    { label: t("calculator.totalPayment"), value: fmtCurrency(lotValue) },
                    { label: t("calculator.downPaymentRequired"), value: currency === "USD" ? "$0" : "₡0" },
                  ].map(({ label, value }, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 px-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
                      <span className="text-sm font-bold text-white">{value}</span>
                    </div>
                  ))}
                  <p className="text-xs px-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {t("calculator.disclaimer")}
                  </p>
                </div>
              </div>

              <button
                onClick={onWhatsAppClick}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                style={{ backgroundColor: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}
              >
                <MessageCircle className="w-4 h-4" />
                {t("calculator.cta")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
