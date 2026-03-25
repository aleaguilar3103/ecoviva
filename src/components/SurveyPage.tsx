import { useEffect } from "react";
import { Leaf, Mountain, Droplets, TreePine } from "lucide-react";

export default function SurveyPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    const script = document.createElement("script");
    script.src = "https://link.bralto.io/js/form_embed.js";
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector(
        'script[src="https://link.bralto.io/js/form_embed.js"]'
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Tropical gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2540] via-[#0d3a5c] to-[#145a32]" />
      
      {/* Animated decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Floating leaves */}
        <div className="absolute top-20 left-10 text-green-400/20 animate-pulse">
          <Leaf className="w-24 h-24 rotate-45" />
        </div>
        <div className="absolute top-40 right-20 text-green-500/15 animate-pulse delay-300">
          <TreePine className="w-32 h-32" />
        </div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20 animate-pulse delay-500">
          <Mountain className="w-40 h-40" />
        </div>
        <div className="absolute bottom-20 right-10 text-cyan-400/15 animate-pulse delay-700">
          <Droplets className="w-28 h-28" />
        </div>
        
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl" />
      </div>

      <main className="flex-1 pt-12 pb-20 relative z-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header section with tropical styling */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur-sm rounded-full border border-green-400/30 mb-6">
                <Leaf className="w-4 h-4 text-green-400" />
                <span className="text-green-300 text-sm font-medium">
                  Eco Viva Desarrollos
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white via-green-200 to-emerald-300 bg-clip-text text-transparent">
                  Aplicación Financiamiento
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Por favor, complete los datos solicitados continuación para su financiamiento.
              </p>
            </div>

            {/* Survey card with glass morphism effect */}
            <div className="relative">
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500 rounded-3xl blur-lg opacity-30" />
              
              <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-2 md:p-3 border border-white/50">
                {/* Decorative top border */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />
                
                <div className="bg-gradient-to-b from-gray-50/50 to-white rounded-2xl p-4 md:p-6">
                  <iframe
                    src="https://link.bralto.io/widget/survey/Mhrt7jgZ2Hd8EGxPWkDZ"
                    style={{ border: "none", width: "100%", minHeight: "600px" }}
                    scrolling="no"
                    id="Mhrt7jgZ2Hd8EGxPWkDZ"
                    title="survey"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Footer message */}
            <div className="text-center mt-8">
              <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
                <span className="w-8 h-px bg-gradient-to-r from-transparent to-gray-500" />
                Gracias por tomarte el tiempo
                <span className="w-8 h-px bg-gradient-to-l from-transparent to-gray-500" />
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
