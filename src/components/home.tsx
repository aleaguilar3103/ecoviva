import Header from "./Header";
import HeroSection from "./HeroSection";
import ProjectShowcase from "./ProjectShowcase";
import FinancingCalculator from "./FinancingCalculator";
import FinancingSection from "./FinancingSection";
import ContactSection from "./ContactSection";
import Footer from "./Footer";

function Home() {
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
