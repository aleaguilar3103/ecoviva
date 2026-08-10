import { useEffect, useRef, useState } from "react";
import { trackLead } from "@/lib/tracking";
import {
  Leaf,
  Mountain,
  Droplets,
  TreePine,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
  CheckCircle2,
  Upload,
  X,
  Eraser,
  Loader2,
} from "lucide-react";

// ─── Opciones (alineadas con los custom fields de GHL) ──────────────────────────

const TIPO_ID = ["Nacional", "Extranjero"];
const SI_NO = ["Si.", "No."];
const CASA = ["Propia.", "Gratuita.", "Alquilada."];
const RESIDENCIA = ["Rural.", "Urbana."];
const ESTADO_CIVIL = [
  "Soltero / a",
  "Casado / a",
  "Divorciado / a",
  "Viudo / a",
  "Separado / a",
  "Unión Libre",
];
const GRADO_ACADEMICO = [
  "Primaria incompleta",
  "Primaria completa",
  "Secundaria incompleta",
  "Secundaria completa",
  "Técnico",
  "Bachillerato universitario",
  "Licenciatura",
  "Maestría / Doctorado",
];
const DEPENDIENTES = ["1", "2", "3", "4", "Más de 4", "No tengo dependientes"];

// ─── Estado del formulario ──────────────────────────────────────────────────────

interface FileVal {
  name: string;
  dataUrl: string;
}

interface FormState {
  tipoId: string;
  numeroId: string;
  nombre: string;
  apellidos: string;
  phone: string;
  email: string;
  consent: boolean;
  casaHabitacion: string;
  ubicacionResidencia: string;
  poseeInmuebles: string;
  poseeVehiculo: string;
  estadoCivil: string;
  gradoAcademico: string;
  dependientes: string;
  poseeDeudas: string;
  pensionado: string;
  tarjetasCredito: string;
  sugef: string;
  cedulaFrontal: FileVal | null;
  cedulaPosterior: FileVal | null;
  firma: string | null;
}

const INITIAL: FormState = {
  tipoId: "",
  numeroId: "",
  nombre: "",
  apellidos: "",
  phone: "",
  email: "",
  consent: false,
  casaHabitacion: "",
  ubicacionResidencia: "",
  poseeInmuebles: "",
  poseeVehiculo: "",
  estadoCivil: "",
  gradoAcademico: "",
  dependientes: "",
  poseeDeudas: "",
  pensionado: "",
  tarjetasCredito: "",
  sugef: "",
  cedulaFrontal: null,
  cedulaPosterior: null,
  firma: null,
};

const STEPS = [
  "Información personal",
  "Contacto",
  "Vivienda y bienes",
  "Perfil",
  "Situación financiera",
  "Documentos",
];

// ─── Utilidades ─────────────────────────────────────────────────────────────────

// Comprime una imagen a JPEG (máx 1400px de lado mayor) para que el payload sea liviano.
function compressImage(file: File, maxSide = 1400, quality = 0.72): Promise<FileVal> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ name: file.name, dataUrl: canvas.toDataURL("image/jpeg", quality) });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─── Subcomponentes de UI ───────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
        {label} {required && <span className="text-green-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder = "Seleccione…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${value ? "" : "text-gray-400"} appearance-none pr-10`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="text-gray-900">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function RadioGroup({
  value,
  onChange,
  options,
  cols = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  cols?: number;
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(o)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              active
                ? "border-green-500 bg-green-50 text-green-800 ring-2 ring-green-500/20"
                : "border-gray-200 bg-white text-gray-700 hover:border-green-300"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                active ? "border-green-500 bg-green-500" : "border-gray-300"
              }`}
            >
              {active && <Check className="h-3 w-3 text-white" />}
            </span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function FileInput({
  value,
  onChange,
}: {
  value: FileVal | null;
  onChange: (v: FileVal | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch {
      // ignorar archivo inválido
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <img src={value.dataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
        <span className="flex-1 truncate text-sm text-gray-700">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-gray-500 transition hover:border-green-400 hover:bg-green-50/50"
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
      <span className="text-sm">{busy ? "Procesando…" : "Toque para subir una foto"}</span>
      <span className="text-xs text-gray-400">JPG, PNG · se comprime automáticamente</span>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
    </button>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Escala para nitidez en pantallas retina.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none"
        />
        {!value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            Firme aquí
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-500"
      >
        <Eraser className="h-3.5 w-3.5" /> Borrar firma
      </button>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function SurveyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, done]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  // Validación por paso. Devuelve un mensaje si falta algo obligatorio.
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!form.tipoId) return "Seleccione el tipo de identificación.";
      if (!form.numeroId.trim()) return "Ingrese su número de identificación.";
      if (!form.nombre.trim()) return "Ingrese su nombre.";
      if (!form.apellidos.trim()) return "Ingrese sus apellidos.";
    }
    if (s === 1) {
      if (!form.phone.trim()) return "Ingrese su número de teléfono.";
      if (!isEmail(form.email)) return "Ingrese un correo electrónico válido.";
      if (!form.consent) return "Debe aceptar el tratamiento de datos (Ley 8968).";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) return setError(err);
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const back = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
  };

  const submit = async () => {
    // Revalidar los pasos obligatorios por si acaso.
    for (const s of [0, 1]) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        return setError(err);
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoId: form.tipoId,
          numeroId: form.numeroId,
          nombre: form.nombre,
          apellidos: form.apellidos,
          phone: form.phone,
          email: form.email,
          consent: form.consent,
          casaHabitacion: form.casaHabitacion,
          ubicacionResidencia: form.ubicacionResidencia,
          poseeInmuebles: form.poseeInmuebles,
          poseeVehiculo: form.poseeVehiculo,
          estadoCivil: form.estadoCivil,
          gradoAcademico: form.gradoAcademico,
          dependientes: form.dependientes,
          poseeDeudas: form.poseeDeudas,
          pensionado: form.pensionado,
          tarjetasCredito: form.tarjetasCredito,
          sugef: form.sugef,
          cedulaFrontal: form.cedulaFrontal?.dataUrl ?? null,
          cedulaPosterior: form.cedulaPosterior?.dataUrl ?? null,
          firma: form.firma,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No pudimos enviar su solicitud.");
      }
      trackLead({
        email: form.email,
        phone: form.phone,
        firstName: form.nombre,
        lastName: form.apellidos,
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Fondo tropical */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2540] via-[#0d3a5c] to-[#145a32]" />
      <div className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden">
        <div className="absolute left-10 top-20 text-green-400/20">
          <Leaf className="h-24 w-24 rotate-45" />
        </div>
        <div className="absolute right-20 top-40 text-green-500/15">
          <TreePine className="h-32 w-32" />
        </div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20">
          <Mountain className="h-40 w-40" />
        </div>
        <div className="absolute bottom-20 right-10 text-cyan-400/15">
          <Droplets className="h-28 w-28" />
        </div>
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <main className="relative z-10 flex-1 pb-20 pt-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-2xl">
            {/* Encabezado */}
            <div className="mb-8 text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/20 px-4 py-2 backdrop-blur-sm">
                <Leaf className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Eco Viva Desarrollos</span>
              </div>
              <h1 className="mb-3 text-3xl font-bold md:text-4xl lg:text-5xl">
                <span className="bg-gradient-to-r from-white via-green-200 to-emerald-300 bg-clip-text text-transparent">
                  Aplicación de Financiamiento
                </span>
              </h1>
              <p className="mx-auto max-w-xl text-gray-300">
                Complete los datos a continuación para iniciar su estudio de financiamiento.
              </p>
            </div>

            {/* Card */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500 opacity-30 blur-lg" />
              <div className="relative rounded-3xl border border-white/50 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl md:p-3">
                <div className="rounded-2xl bg-white p-5 md:p-8">
                  {done ? (
                    <ThankYou />
                  ) : (
                    <>
                      {/* Progreso */}
                      <div className="mb-6">
                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
                          <span>
                            Paso {step + 1} de {STEPS.length}
                          </span>
                          <span>{STEPS[step]}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="min-h-[320px]">
                        <StepContent step={step} form={form} set={set} />
                      </div>

                      {error && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {error}
                        </div>
                      )}

                      {/* Navegación */}
                      <div className="mt-6 flex gap-3">
                        {step > 0 && (
                          <button
                            type="button"
                            onClick={back}
                            disabled={submitting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ArrowLeft className="h-4 w-4" /> Atrás
                          </button>
                        )}
                        {step < STEPS.length - 1 ? (
                          <button
                            type="button"
                            onClick={next}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3 font-semibold text-white shadow-lg shadow-green-900/20 transition hover:from-green-400 hover:to-emerald-400"
                          >
                            Siguiente <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={submit}
                            disabled={submitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3 font-semibold text-white shadow-lg shadow-green-900/20 transition hover:from-green-400 hover:to-emerald-400 disabled:opacity-60"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                              </>
                            ) : (
                              <>
                                Enviar solicitud <Check className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-gray-500" />
                Sus datos están protegidos
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-gray-500" />
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Contenido de cada paso ─────────────────────────────────────────────────────

function StepContent({
  step,
  form,
  set,
}: {
  step: number;
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  if (step === 0)
    return (
      <div className="space-y-5 animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">Información personal</h2>
        <Field label="Tipo de identificación" required>
          <SelectInput value={form.tipoId} onChange={(v) => set("tipoId", v)} options={TIPO_ID} />
        </Field>
        <Field label="Número de identificación" required>
          <TextInput
            inputMode="numeric"
            value={form.numeroId}
            onChange={(e) => set("numeroId", e.target.value)}
            placeholder="Número de identificación"
          />
        </Field>
        <Field label="Nombre" hint="Escriba su nombre tal como aparece en su documento de identidad." required>
          <TextInput
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre"
          />
        </Field>
        <Field label="Apellidos" hint="Escriba sus apellidos tal como aparecen en su documento de identidad." required>
          <TextInput
            value={form.apellidos}
            onChange={(e) => set("apellidos", e.target.value)}
            placeholder="Apellidos"
          />
        </Field>
      </div>
    );

  if (step === 1)
    return (
      <div className="space-y-5 animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">Información de contacto</h2>
        <Field label="Teléfono" required>
          <TextInput
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="Ej. 8888 8888"
          />
        </Field>
        <Field label="Correo electrónico" required>
          <TextInput
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="correo@ejemplo.com"
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => set("consent", e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 accent-green-600"
          />
          <span className="text-xs leading-relaxed text-gray-600">
            Acepto y autorizo que Eco Viva Desarrollos consulte y utilice mis datos personales de
            acceso irrestricto, así como los contenidos en fuentes o bases de datos privadas que se
            encuentren autorizadas al efecto. Declaro que he sido informado que mis datos personales
            se utilizarán de manera responsable y acorde con la Ley No. 8968, Ley de Protección de la
            persona frente al tratamiento de sus datos personales.{" "}
            <a
              href="https://www.pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?param1=NRTC&nValor1=1&nValor2=70975"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-green-600 underline"
            >
              Ver ley 8968
            </a>
          </span>
        </label>
      </div>
    );

  if (step === 2)
    return (
      <div className="space-y-5 animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">Información para estudio</h2>
        <p className="-mt-3 text-sm text-gray-500">
          La información suministrada quedará sujeta a verificación una vez aportados los requisitos.
        </p>
        <Field label="Su casa de habitación es">
          <RadioGroup
            value={form.casaHabitacion}
            onChange={(v) => set("casaHabitacion", v)}
            options={CASA}
          />
        </Field>
        <Field label="Ubicación de residencia">
          <RadioGroup
            value={form.ubicacionResidencia}
            onChange={(v) => set("ubicacionResidencia", v)}
            options={RESIDENCIA}
            cols={2}
          />
        </Field>
        <Field label="¿Posee inmuebles?">
          <RadioGroup
            value={form.poseeInmuebles}
            onChange={(v) => set("poseeInmuebles", v)}
            options={SI_NO}
            cols={2}
          />
        </Field>
        <Field label="¿Posee vehículo propio?">
          <RadioGroup
            value={form.poseeVehiculo}
            onChange={(v) => set("poseeVehiculo", v)}
            options={SI_NO}
            cols={2}
          />
        </Field>
      </div>
    );

  if (step === 3)
    return (
      <div className="space-y-5 animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">Información para estudio</h2>
        <Field label="Estado civil">
          <SelectInput
            value={form.estadoCivil}
            onChange={(v) => set("estadoCivil", v)}
            options={ESTADO_CIVIL}
          />
        </Field>
        <Field label="Grado académico">
          <SelectInput
            value={form.gradoAcademico}
            onChange={(v) => set("gradoAcademico", v)}
            options={GRADO_ACADEMICO}
          />
        </Field>
        <Field label="Cantidad de dependientes">
          <SelectInput
            value={form.dependientes}
            onChange={(v) => set("dependientes", v)}
            options={DEPENDIENTES}
          />
        </Field>
      </div>
    );

  if (step === 4)
    return (
      <div className="space-y-5 animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">Situación financiera</h2>
        <Field label="¿Posee deudas?">
          <RadioGroup value={form.poseeDeudas} onChange={(v) => set("poseeDeudas", v)} options={SI_NO} cols={2} />
        </Field>
        <Field label="¿Es usted pensionado?">
          <RadioGroup value={form.pensionado} onChange={(v) => set("pensionado", v)} options={SI_NO} cols={2} />
        </Field>
        <Field label="¿Posee tarjetas de crédito?">
          <RadioGroup
            value={form.tarjetasCredito}
            onChange={(v) => set("tarjetasCredito", v)}
            options={SI_NO}
            cols={2}
          />
        </Field>
      </div>
    );

  // step === 5
  return (
    <div className="space-y-5 animate-fadeIn">
      <h2 className="text-xl font-bold text-gray-900">Documentos</h2>
      <p className="-mt-3 text-sm text-gray-500">
        Para agilizar su trámite, puede adjuntar los documentos solicitados. Es opcional, pero
        recomendado.
      </p>
      <Field label="Fotografía de la parte frontal de su cédula">
        <FileInput value={form.cedulaFrontal} onChange={(v) => set("cedulaFrontal", v)} />
      </Field>
      <Field label="Fotografía de la parte posterior de su cédula">
        <FileInput value={form.cedulaPosterior} onChange={(v) => set("cedulaPosterior", v)} />
      </Field>
      <Field label="Firma">
        <SignaturePad value={form.firma} onChange={(v) => set("firma", v)} />
      </Field>
      <Field label="¿Desea incluir los datos en el documento de autorización específica persona física Sugef? (opcional)">
        <RadioGroup value={form.sugef} onChange={(v) => set("sugef", v)} options={SI_NO} cols={2} />
      </Field>
    </div>
  );
}

function ThankYou() {
  return (
    <div className="flex flex-col items-center py-10 text-center animate-fadeIn">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-9 w-9 text-green-600" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900">¡Solicitud enviada!</h2>
      <p className="max-w-md text-gray-600">
        Gracias por completar su aplicación de financiamiento. Un asesor de Eco Viva Desarrollos
        revisará su información y le contactará muy pronto.
      </p>
    </div>
  );
}
