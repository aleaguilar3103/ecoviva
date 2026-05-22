import { Suspense, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import MaintenancePage from "./components/MaintenancePage";

const MAINTENANCE = false;
import Home from "./components/home";
import RioCelesteDetail from "./components/RioCelesteDetail";
import LomasLlanadaDetail from "./components/LomasLlanadaDetail";
import BookingPage from "./components/BookingPage";
import SurveyPage from "./components/SurveyPage";
import ConfirmationPage from "./components/ConfirmationPage";
import { LanguageProvider } from "./contexts/LanguageContext";
import BrandBook from "./components/BrandBook";
import FunnelPage from "./components/FunnelPage";
import FunnelThankYou from "./components/FunnelThankYou";
import FunnelDiscard from "./components/FunnelDiscard";
import FunnelStep1 from "./components/FunnelStep1";
import FunnelLlanada from "./components/FunnelLlanada";

// Silently redirects first-time EN-browser visitors from / to /en.
// Runs only once (no stored preference). URL is always the source of truth after that.
function LocaleDetector() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/") return;
    const stored = localStorage.getItem("ecoviva_locale");
    if (!stored) {
      const browser = navigator.language.split("-")[0];
      const detected = browser === "es" ? "es" : "en";
      localStorage.setItem("ecoviva_locale", detected);
      if (detected === "en") navigate("/en", { replace: true });
    }
  }, []);

  return null;
}

// Shared page routes — used inside both locale trees
function SharedRoutes() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="rio-celeste-oasis-detalle" element={<RioCelesteDetail />} />
      <Route path="lomas-de-la-llanada-detalle" element={<LomasLlanadaDetail />} />
      <Route path="agendar-visita" element={<BookingPage />} />
      <Route path="survey" element={<SurveyPage />} />
      <Route path="confirmation" element={<ConfirmationPage />} />
    </Routes>
  );
}

function App() {
  if (MAINTENANCE) return <MaintenancePage />;

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Routes>
        {/* EN locale — /en and /en/* */}
        <Route
          path="/en/*"
          element={
            <LanguageProvider locale="en">
              <SharedRoutes />
            </LanguageProvider>
          }
        />

        {/* ES locale (default) — also hosts funnel + brandbook (ES-only flows) */}
        <Route
          path="/*"
          element={
            <LanguageProvider locale="es">
              <>
                <LocaleDetector />
                <Routes>
                  <Route index element={<Home />} />
                  <Route path="rio-celeste-oasis-detalle" element={<RioCelesteDetail />} />
                  <Route path="lomas-de-la-llanada-detalle" element={<LomasLlanadaDetail />} />
                  <Route path="agendar-visita" element={<BookingPage />} />
                  <Route path="survey" element={<SurveyPage />} />
                  <Route path="confirmation" element={<ConfirmationPage />} />
                  <Route path="brandbook" element={<BrandBook />} />
                  <Route path="funnel" element={<FunnelPage />} />
                  <Route path="funnel/step1" element={<FunnelStep1 />} />
                  <Route path="funnel/llanada" element={<FunnelLlanada />} />
                  <Route path="funnel/gracias" element={<FunnelThankYou />} />
                  <Route path="funnel/descartado" element={<FunnelDiscard />} />
                </Routes>
              </>
            </LanguageProvider>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
