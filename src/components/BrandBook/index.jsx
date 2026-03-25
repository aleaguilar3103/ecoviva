import { useScrollReveal } from './useScrollReveal';
import Nav from './Nav';
import Hero from './Hero';
import LogoSection from './LogoSection';
import ColorSection from './ColorSection';
import TypographySection from './TypographySection';
import VoiceSection from './VoiceSection';
import PersonalitySection from './PersonalitySection';
import ApplicationsSection from './ApplicationsSection';
import Footer from './Footer';
import '../../styles/BrandBook.css';

export default function BrandBook() {
  useScrollReveal();

  return (
    <div className="brandbook">
      <Nav />
      <Hero />
      <LogoSection />
      <div className="bb-divider" />
      <ColorSection />
      <div className="bb-divider" />
      <TypographySection />
      <VoiceSection />
      <PersonalitySection />
      <ApplicationsSection />
      <Footer />
    </div>
  );
}
