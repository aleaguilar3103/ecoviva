import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rio-celeste-oasis-detalle" element={<RioCelesteDetail />} />
            <Route path="/lomas-de-la-llanada-detalle" element={<LomasLlanadaDetail />} />
            <Route path="/agendar-visita" element={<BookingPage />} />
            <Route path="/survey" element={<SurveyPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
            <Route path="/brandbook" element={<BrandBook />} />
            <Route path="/funnel/step1" element={<FunnelStep1 />} />
            <Route path="/funnel/llanada" element={<FunnelLlanada />} />
            <Route path="/funnel" element={<FunnelPage />} />
            <Route path="/funnel/gracias" element={<FunnelThankYou />} />
            <Route path="/funnel/descartado" element={<FunnelDiscard />} />
          </Routes>
        </>
      </Suspense>
    </LanguageProvider>
  );
}

export default App;
