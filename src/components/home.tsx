import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import HeroSection from "./HeroSection";
import ProjectShowcase from "./ProjectShowcase";
import WhyEcoviva from "./WhyEcoviva";
import FinancingCalculator from "./FinancingCalculator";
import FinancingSection from "./FinancingSection";
import ContactSection from "./ContactSection";
import Footer from "./Footer";

function Home() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
    } else if (location.state?.scrollTo) {
      setTimeout(() => document.getElementById(location.state.scrollTo)?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [location]);

  return (
    <div style={{ backgroundColor: "#0d1410", minHeight: "100vh" }}>
      <Header />
      <HeroSection />
      <ProjectShowcase />
      <WhyEcoviva />
      <FinancingCalculator />
      <FinancingSection />
      <ContactSection />
      <Footer />
    </div>
  );
}

export default Home;
