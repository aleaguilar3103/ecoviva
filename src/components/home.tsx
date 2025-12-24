import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import HeroSection from "./HeroSection";
import ProjectShowcase from "./ProjectShowcase";
import FinancingCalculator from "./FinancingCalculator";
import FinancingSection from "./FinancingSection";
import ContactSection from "./ContactSection";
import Footer from "./Footer";

function Home() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      setTimeout(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location]);

  return (
    <div className="w-full min-h-screen bg-white">
      <Header />
      <HeroSection />
      <ProjectShowcase />
      <FinancingCalculator />
      <FinancingSection />
      <ContactSection />
      <Footer />
    </div>
  );
}

export default Home;
