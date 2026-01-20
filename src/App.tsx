import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./components/home";
import RioCelesteDetail from "./components/RioCelesteDetail";
import BookingPage from "./components/BookingPage";
import SurveyPage from "./components/SurveyPage";
import ConfirmationPage from "./components/ConfirmationPage";
import { LanguageProvider } from "./contexts/LanguageContext";

function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rio-celeste-oasis-detalle" element={<RioCelesteDetail />} />
            <Route path="/agendar-visita" element={<BookingPage />} />
            <Route path="/survey" element={<SurveyPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
          </Routes>
        </>
      </Suspense>
    </LanguageProvider>
  );
}

export default App;
