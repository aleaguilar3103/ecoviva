import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle, Leaf, TreePine, Mountain, Droplets } from "lucide-react";

export default function FunnelThankYou() {
  const [timeLeft, setTimeLeft] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    if (timeLeft <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const progress = ((10 - timeLeft) / 10) * 100;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2540] via-[#0d3a5c] to-[#145a32]" />

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-green-400/20 animate-pulse">
          <Leaf className="w-24 h-24 rotate-45" />
        </div>
        <div className="absolute top-40 right-16 text-green-500/15 animate-pulse delay-300">
          <TreePine className="w-32 h-32" />
        </div>
        <div className="absolute bottom-40 left-16 text-emerald-400/20 animate-pulse delay-500">
          <Mountain className="w-40 h-40" />
        </div>
        <div className="absolute bottom-20 right-10 text-cyan-400/15 animate-pulse delay-700">
          <Droplets className="w-28 h-28" />
        </div>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center relative z-10 px-4 py-12">
        <div className="max-w-lg w-full">
          {/* Glow border */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500 rounded-3xl blur-lg opacity-40 animate-pulse" />

            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 border border-white/50 text-center">
              {/* Top accent */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />

              {/* Icon */}
              <div className="mb-6 inline-flex relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4">
                  <Calendar className="w-14 h-14 text-white" />
                </div>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-400/30 mb-5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700 text-sm font-medium">
                  Cita confirmada
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                <span className="bg-gradient-to-r from-[#0a2540] via-green-700 to-emerald-600 bg-clip-text text-transparent">
                  ¡Nos vemos pronto!
                </span>
              </h1>

              <p className="text-lg text-gray-600 mb-2">
                Tu visita quedó agendada 🌿
              </p>

              {/* Message */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 mb-8 border border-green-100">
                <p className="text-gray-700 leading-relaxed text-sm">
                  Un asesor de Eco Viva te contactará para confirmar los
                  detalles de tu visita. Prepárate para descubrir tu próximo
                  hogar en la naturaleza.
                </p>
              </div>

              {/* Countdown */}
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Redirigiendo al inicio en
                </p>

                <div className="relative inline-flex items-center justify-center">
                  <svg
                    className="w-20 h-20 transform -rotate-90"
                    viewBox="0 0 80 80"
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#e5e7eb"
                      strokeWidth="7"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="url(#funnelGrad)"
                      strokeWidth="7"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={
                        2 * Math.PI * 32 * (1 - progress / 100)
                      }
                      className="transition-all duration-1000 ease-linear"
                    />
                    <defs>
                      <linearGradient
                        id="funnelGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {timeLeft}
                  </span>
                </div>

                <p className="text-xs text-gray-400">segundos</p>

                <button
                  onClick={() => navigate("/", { replace: true })}
                  className="mt-2 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-full hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-sm"
                >
                  Ir al inicio ahora
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
