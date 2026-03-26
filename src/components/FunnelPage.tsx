import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfToday, addBusinessDays } from "date-fns";
import "react-day-picker/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Droplets,
  Leaf,
  Loader2,
  MapPin,
  Mountain,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROYECTOS = [
  {
    value: "lomas-de-la-llanada",
    label: "Lomas de la Llanada",
    icon: Mountain,
    gradient: "from-emerald-700 to-emerald-500",
    desc: "Fincas en las montañas",
  },
  {
    value: "oasis-rio-celeste",
    label: "Oasis Río Celeste",
    icon: Droplets,
    gradient: "from-cyan-600 to-cyan-400",
    desc: "Lotes junto al río",
  },
] as const;

const PRESUPUESTOS = [
  { value: "menos-500", label: "Menos de $500" },
  { value: "500-1000", label: "$500 – $1,000" },
  { value: "1000-2500", label: "$1,000 – $2,500" },
  { value: "2500-5000", label: "$2,500 – $5,000" },
  { value: "mas-5000", label: "Más de $5,000" },
] as const;

const TIME_SLOTS = [
  { display: "8:00 AM",  key: "08:00" },
  { display: "9:00 AM",  key: "09:00" },
  { display: "10:00 AM", key: "10:00" },
  { display: "11:00 AM", key: "11:00" },
  // 12:00–13:30 = almuerzo
  { display: "2:00 PM",  key: "14:00" },
  { display: "3:00 PM",  key: "15:00" },
  { display: "4:00 PM",  key: "16:00" },
];

const PROYECTO_LABELS: Record<string, string> = {
  "lomas-de-la-llanada": "Lomas de la Llanada",
  "oasis-rio-celeste": "Oasis Río Celeste",
};

const PRESUPUESTO_LABELS: Record<string, string> = {
  "menos-500": "Menos de $500",
  "500-1000": "$500 – $1,000",
  "1000-2500": "$1,000 – $2,500",
  "2500-5000": "$2,500 – $5,000",
  "mas-5000": "Más de $5,000",
};

const CODIGOS_PAIS = [
  { bandera: "🇨🇷", pais: "Costa Rica",       codigo: "+506"  },
  { bandera: "🇺🇸", pais: "Estados Unidos",   codigo: "+1"    },
  { bandera: "🇲🇽", pais: "México",            codigo: "+52"   },
  { bandera: "🇬🇹", pais: "Guatemala",         codigo: "+502"  },
  { bandera: "🇸🇻", pais: "El Salvador",       codigo: "+503"  },
  { bandera: "🇭🇳", pais: "Honduras",          codigo: "+504"  },
  { bandera: "🇳🇮", pais: "Nicaragua",         codigo: "+505"  },
  { bandera: "🇵🇦", pais: "Panamá",            codigo: "+507"  },
  { bandera: "🇨🇴", pais: "Colombia",          codigo: "+57"   },
  { bandera: "🇻🇪", pais: "Venezuela",         codigo: "+58"   },
  { bandera: "🇪🇨", pais: "Ecuador",           codigo: "+593"  },
  { bandera: "🇵🇪", pais: "Perú",              codigo: "+51"   },
  { bandera: "🇨🇱", pais: "Chile",             codigo: "+56"   },
  { bandera: "🇦🇷", pais: "Argentina",         codigo: "+54"   },
  { bandera: "🇧🇷", pais: "Brasil",            codigo: "+55"   },
  { bandera: "🇩🇴", pais: "R. Dominicana",     codigo: "+1809" },
  { bandera: "🇵🇷", pais: "Puerto Rico",       codigo: "+1787" },
  { bandera: "🇪🇸", pais: "España",            codigo: "+34"   },
  { bandera: "🇨🇦", pais: "Canadá",            codigo: "+1"    },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  nombre: z.string().min(2, "Ingresa tu nombre"),
  apellido: z.string().min(2, "Ingresa tu apellido"),
  telefono: z.string().min(8, "Ingresa un teléfono válido"),
  correo: z.string().email("Ingresa un correo electrónico válido"),
  proyecto: z.enum(["lomas-de-la-llanada", "oasis-rio-celeste"], {
    required_error: "Selecciona un proyecto",
  }),
  presupuesto: z.enum(
    ["menos-500", "500-1000", "1000-2500", "2500-5000", "mas-5000"],
    { required_error: "Selecciona tu presupuesto mensual" }
  ),
});

type Step1Data = z.infer<typeof step1Schema>;

// ─── DayPicker brand overrides ────────────────────────────────────────────────

const rdpVars = {
  "--rdp-accent-color": "hsl(152, 68%, 28%)",
  "--rdp-background-color": "hsl(152, 68%, 95%)",
  "--rdp-accent-color-dark": "hsl(152, 68%, 35%)",
} as CSSProperties;

// ─── Component ────────────────────────────────────────────────────────────────

export default function FunnelPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<Step1Data | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paisKey, setPaisKey] = useState("Costa Rica");
  const paisActual = CODIGOS_PAIS.find((p) => p.pais === paisKey) ?? CODIGOS_PAIS[0];
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (localStorage.getItem("ecoviva_funnel_status") === "discarded") {
      navigate("/funnel/descartado", { replace: true });
    }
  }, [navigate]);

  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { nombre: "", apellido: "", telefono: "", correo: "" },
  });

  const proyectoSeleccionado = form.watch("proyecto");

  const onStep1Submit = (data: Step1Data) => {
    const webhookUrl = (import.meta.env as Record<string, string>)
      .NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (data.presupuesto === "menos-500") {
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: data.nombre,
            apellido: data.apellido,
            codigoPais: paisActual.codigo,
            pais: paisActual.pais,
            telefono: `${paisActual.codigo} ${data.telefono}`,
            correo: data.correo,
            proyecto: PROYECTO_LABELS[data.proyecto],
            presupuesto: PRESUPUESTO_LABELS[data.presupuesto],
            calificado: false,
          }),
        }).catch(() => {});
      }
      localStorage.setItem("ecoviva_funnel_status", "discarded");
      navigate("/funnel/descartado", { replace: true });
      return;
    }

    setFormData(data);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fetch booked slots whenever the user picks a date
  useEffect(() => {
    if (!selectedDate) return;
    setBookedSlots([]);
    setSelectedTime(undefined);
    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(`/api/slots?date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => setBookedSlots(data.booked ?? []))
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const onStep2Submit = async () => {
    if (!selectedDate || !selectedTime || !formData) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const slotDisplay = TIME_SLOTS.find((s) => s.key === selectedTime)?.display ?? selectedTime;
    const fecha = format(selectedDate, "yyyy-MM-dd");

    const payload = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      codigoPais: paisActual.codigo,
      pais: paisActual.pais,
      telefono: `${paisActual.codigo} ${formData.telefono}`,
      correo: formData.correo,
      proyecto: PROYECTO_LABELS[formData.proyecto],
      presupuesto: PRESUPUESTO_LABELS[formData.presupuesto],
      calificado: true,
      fecha,
      slotKey: selectedTime,
      hora: slotDisplay,
      fechaLegible: format(selectedDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
    };

    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        setSubmitError("Ese horario ya fue reservado. Por favor elige otro.");
        // Refresh slots so the UI reflects the taken slot
        fetch(`/api/slots?date=${fecha}`)
          .then((r) => r.json())
          .then((data) => {
            setBookedSlots(data.booked ?? []);
            setSelectedTime(undefined);
          })
          .catch(() => {});
        return;
      }

      if (!res.ok) throw new Error("reserve_error");
      navigate("/funnel/gracias");
    } catch {
      setSubmitError("Hubo un problema al confirmar tu cita. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = startOfToday();
  const tomorrow = addBusinessDays(today, 1);
  const maxDate = addBusinessDays(today, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo + step indicator */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">Eco Viva</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors",
                step === 1
                  ? "bg-primary text-white"
                  : "bg-primary/20 text-primary"
              )}
            >
              {step > 1 ? <CheckCircle className="w-4 h-4" /> : "1"}
            </div>
            <div
              className={cn(
                "w-10 h-0.5 transition-colors",
                step === 2 ? "bg-primary" : "bg-gray-200"
              )}
            />
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors",
                step === 2
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-400"
              )}
            >
              2
            </div>
            <span className="ml-1 text-gray-400 hidden sm:inline">
              Paso {step} de 2
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 pb-16">
        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Encuentra tu lote ideal
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Cuéntanos sobre ti para ayudarte mejor
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onStep1Submit)}
                className="space-y-5"
              >
                {/* Personal info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                    Tu información
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. María" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="apellido"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Rodríguez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <select
                              value={paisKey}
                              onChange={(e) => setPaisKey(e.target.value)}
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              {CODIGOS_PAIS.map((p) => (
                                <option
                                  key={`${p.pais}-${p.codigo}`}
                                  value={p.pais}
                                >
                                  {p.bandera} {p.codigo}
                                </option>
                              ))}
                            </select>
                            <Input
                              placeholder="8888-8888"
                              type="tel"
                              className="flex-1"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="correo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="maria@ejemplo.com"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Project selection */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                    ¿Qué proyecto te interesa?
                  </h2>

                  <FormField
                    control={form.control}
                    name="proyecto"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 gap-3">
                          {PROYECTOS.map((p) => {
                            const Icon = p.icon;
                            const selected = field.value === p.value;
                            return (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => field.onChange(p.value)}
                                className={cn(
                                  "relative rounded-xl p-4 text-left border-2 transition-all duration-200",
                                  selected
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-gray-100 bg-gray-50 hover:border-primary/30"
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                                    p.gradient
                                  )}
                                >
                                  <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="font-semibold text-gray-900 text-sm leading-snug">
                                  {p.label}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {p.desc}
                                </div>
                                {selected && (
                                  <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Budget — conditional on project selection */}
                {proyectoSeleccionado && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                      ¿Cuál es tu presupuesto mensual?
                    </h2>

                    <FormField
                      control={form.control}
                      name="presupuesto"
                      render={({ field }) => (
                        <FormItem>
                          <div className="space-y-2">
                            {PRESUPUESTOS.map((p) => {
                              const selected = field.value === p.value;
                              return (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() => field.onChange(p.value)}
                                  className={cn(
                                    "w-full flex items-center justify-between rounded-xl px-4 py-3 border-2 transition-all duration-200 text-sm font-medium",
                                    selected
                                      ? "border-primary bg-primary text-white"
                                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-primary/30"
                                  )}
                                >
                                  {p.label}
                                  {selected && (
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12 text-base"
                >
                  Continuar
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </form>
            </Form>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSelectedDate(undefined);
                setSelectedTime(undefined);
              }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al formulario
            </button>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Agenda tu visita presencial
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Ven a conocer el proyecto con tus propios ojos
              </p>
            </div>

            {/* Persuasive banner */}
            <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                Conoce el proyecto en persona, sin compromisos
              </div>
              <ul className="space-y-2 text-sm text-white/90">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Recorre el terreno, los accesos y la naturaleza
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Conversa con uno de nuestros asesores y resuelve tus dudas
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Explora las opciones de financiamiento a tu ritmo
                </li>
              </ul>
            </div>

            {/* Date picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4 font-semibold text-gray-800 text-sm">
                <Calendar className="w-5 h-5 text-primary" />
                Elige una fecha
              </div>
              <div style={rdpVars} className="flex justify-center">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={es}
                  disabled={[
                    { before: tomorrow },
                    { after: maxDate },
                    { dayOfWeek: [0, 6] },
                  ]}
                  fromDate={tomorrow}
                  toDate={maxDate}
                />
              </div>
            </div>

            {/* Time slots — conditional on date */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4 font-semibold text-gray-800 text-sm">
                  <Clock className="w-5 h-5 text-primary" />
                  Elige un horario
                  <span className="ml-1 font-normal text-gray-400">
                    — {format(selectedDate, "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4 text-sm text-gray-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando disponibilidad…
                  </div>
                ) : TIME_SLOTS.filter((s) => !bookedSlots.includes(s.key)).length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                    No hay disponibilidad para esta fecha. Por favor elige otro día.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TIME_SLOTS.filter((s) => !bookedSlots.includes(s.key)).map((slot) => (
                      <button
                        key={slot.key}
                        type="button"
                        onClick={() => setSelectedTime(slot.key)}
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-sm font-medium border-2 transition-all duration-200",
                          selectedTime === slot.key
                            ? "border-primary bg-primary text-white"
                            : "border-gray-100 bg-gray-50 text-gray-700 hover:border-primary/30"
                        )}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                {submitError}
              </div>
            )}

            <Button
              type="button"
              onClick={onStep2Submit}
              disabled={!selectedDate || !selectedTime || isSubmitting}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12 text-base disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Confirmando visita…
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  Confirmar visita
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
