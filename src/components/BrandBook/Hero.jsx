import { LOGOS } from './logos';

export default function Hero() {
  return (
    <section className="bb-hero">
      <div className="bb-hero-content">
        <img src={LOGOS.colorHorizontal} alt="EcoViva Desarrollos" className="bb-hero-logo" />
        <p className="bb-hero-title">Manual de Identidad de Marca</p>
        <h1 className="bb-hero-subtitle">
          Brand Book
          <br />
          2025
        </h1>
        <div className="bb-hero-line" />
      </div>
      <div className="bb-hero-scroll">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
