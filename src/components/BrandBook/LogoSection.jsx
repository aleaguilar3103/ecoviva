import { LOGOS } from './logos';

const logoCards = [
  { src: LOGOS.colorHorizontal, label: 'Principal — Fondo oscuro', theme: 'bb-card-dark' },
  { src: LOGOS.grisHorizontal, label: 'Escala de grises — Oscuro', theme: 'bb-card-light' },
  { src: LOGOS.blancoHorizontal, label: 'Versión blanca — Fondo oscuro', theme: 'bb-card-dark' },
  { src: LOGOS.colorVertical, label: 'Vertical — A color', theme: 'bb-card-light' },
  { src: LOGOS.blancoVertical, label: 'Vertical — Blanco', theme: 'bb-card-dark' },
  { src: LOGOS.grisVertical, label: 'Vertical — Escala de grises', theme: 'bb-card-light' },
];

const donts = [
  'No rotar ni inclinar el logotipo',
  'No cambiar los colores de marca',
  'No distorsionar ni estirar proporcionalmente',
  'No colocar sobre fondos con bajo contraste',
  'No agregar sombras ni efectos al logo',
  'No usar por debajo de 80px de ancho',
];

export default function LogoSection() {
  return (
    <section className="bb-section" id="logo">
      <div className="bb-section-header bb-reveal">
        <p className="bb-section-label">01 — Logotipo</p>
        <h2 className="bb-section-title">Nuestra marca visual</h2>
        <p className="bb-section-desc">
          El isotipo combina un check con elementos orgánicos (hojas y terreno), representando la
          decisión inteligente en armonía con la naturaleza. Se utiliza en distintas versiones según
          el contexto.
        </p>
      </div>

      {/* Logo grid */}
      <div className="bb-logo-grid">
        {logoCards.map((card, i) => (
          <div className={`bb-logo-card ${card.theme} bb-reveal`} key={i}>
            <img src={card.src} alt={card.label} />
            <span className="bb-logo-card-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Spacing */}
      <div className="bb-spacing-demo bb-reveal">
        <h3 className="bb-type-label" style={{ marginBottom: '1.5rem' }}>
          Zona de protección
        </h3>
        <div className="bb-spacing-visual">
          <img src={LOGOS.colorHorizontal} alt="Zona de protección" />
        </div>
        <p className="bb-spacing-note">
          El área de protección mínima equivale a la altura del isotipo (el check) en todos los
          lados. Ningún elemento gráfico o texto debe invadir esta zona para garantizar legibilidad
          e impacto visual.
        </p>
      </div>

      {/* Don'ts */}
      <div className="bb-reveal" style={{ marginTop: '2.5rem' }}>
        <h3 className="bb-type-label" style={{ marginBottom: '1.5rem' }}>
          Usos incorrectos
        </h3>
        <div className="bb-donts-grid">
          {donts.map((text, i) => (
            <div className="bb-dont-card" key={i}>
              <div className="bb-dont-icon">✗</div>
              <p className="bb-dont-text">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
