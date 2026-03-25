const scaleItems = [
  { label: 'Display', style: { fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em' }, text: 'EcoViva' },
  { label: 'H1', style: { fontSize: '2.2rem', fontWeight: 700 }, text: 'Título principal' },
  { label: 'H2', style: { fontSize: '1.6rem', fontWeight: 600 }, text: 'Subtítulo de sección' },
  { label: 'H3', style: { fontSize: '1.2rem', fontWeight: 600 }, text: 'Encabezado menor' },
  { label: 'Body', style: { fontSize: '1rem', fontWeight: 400 }, text: 'Texto de cuerpo regular para párrafos y contenido.' },
  { label: 'Caption', style: { fontSize: '0.78rem', fontWeight: 500, color: 'var(--gray-mid)' }, text: 'Texto auxiliar, etiquetas y notas al pie.' },
];

export default function TypographySection() {
  return (
    <section className="bb-section" id="tipografia">
      <div className="bb-section-header bb-reveal">
        <p className="bb-section-label">03 — Tipografía</p>
        <h2 className="bb-section-title">La voz escrita</h2>
        <p className="bb-section-desc">
          Dos familias tipográficas que equilibran fuerza y elegancia. Montserrat para titulares con
          impacto, Europa Grotesk SH para textos con carácter.
        </p>
      </div>

      <div className="bb-type-showcase bb-reveal">
        {/* Montserrat */}
        <div className="bb-type-card">
          <p className="bb-type-label">Tipografía principal — Títulos</p>
          <h3 className="bb-type-name" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Montserrat
          </h3>
          <p className="bb-type-meta">Google Fonts — Geométrica sans-serif</p>
          <p className="bb-type-alphabet" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            <br />
            abcdefghijklmnñopqrstuvwxyz
            <br />
            0123456789 !@#$%&amp;
          </p>
          <div className="bb-type-weights">
            {['Light 300', 'Regular 400', 'SemiBold 600', 'Bold 700', 'ExtraBold 800', 'Black 900'].map(
              (w) => (
                <span className="bb-weight-tag" key={w}>
                  {w}
                </span>
              )
            )}
          </div>
        </div>

        {/* Europa Grotesk */}
        <div className="bb-type-card">
          <p className="bb-type-label">Tipografía secundaria — Subtítulos / Cuerpo</p>
          <h3 className="bb-type-name" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}>
            Europa Grotesk SH
          </h3>
          <p className="bb-type-meta">Tipografía personalizada — Grotesk humanista</p>
          <p className="bb-type-alphabet" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}>
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            <br />
            abcdefghijklmnñopqrstuvwxyz
            <br />
            0123456789 !@#$%&amp;
          </p>
          <div className="bb-type-weights">
            {['Regular', 'Medium', 'Bold'].map((w) => (
              <span className="bb-weight-tag" key={w}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Scale */}
      <div className="bb-type-scale bb-reveal">
        <p className="bb-type-label" style={{ marginBottom: '1.5rem' }}>
          Escala tipográfica
        </p>
        {scaleItems.map((item) => (
          <div className="bb-scale-item" key={item.label}>
            <span className="bb-scale-label">{item.label}</span>
            <span className="bb-scale-demo" style={item.style}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
