const traits = [
  { emoji: '📍', name: 'Local', desc: 'Arraigada en la zona norte de Costa Rica' },
  { emoji: '📈', name: 'En crecimiento', desc: 'Proyectos activos con alta plusvalía' },
  { emoji: '🤝', name: 'Accesible', desc: 'Condiciones que se adaptan a cada perfil' },
  { emoji: '🏡', name: 'Para vivir o invertir', desc: 'Opciones para construir o rentabilizar' },
  { emoji: '✅', name: 'Transparente', desc: 'Sin letra pequeña, sin sorpresas' },
  { emoji: '🌿', name: 'Consciente', desc: 'Desarrollo en armonía con el entorno natural' },
];

export default function PersonalitySection() {
  return (
    <div
      className="bb-dark-section"
      id="personalidad"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="bb-section" style={{ paddingTop: '7rem', paddingBottom: '7rem' }}>
        <div className="bb-section-header bb-reveal">
          <p className="bb-section-label">05 — Personalidad de marca</p>
          <h2 className="bb-section-title">Quién es EcoViva</h2>
          <p className="bb-section-desc">
            EcoViva es un desarrollo inmobiliario en crecimiento en la zona norte de Costa Rica.
            Ofrecemos lotes para inversión o para construir el hogar propio, con precios accesibles
            y las mejores condiciones del mercado.
          </p>
        </div>

        {/* Archetype */}
        <div className="bb-archetype-banner bb-reveal">
          <div className="bb-archetype-icon">🌱</div>
          <div>
            <p className="bb-archetype-main">El Desarrollador</p>
            <p className="bb-archetype-sub">
              Arquetipo principal — Secundarios: 🤝 El Aliado + 🏔 El Visionario
            </p>
          </div>
        </div>

        {/* Traits */}
        <div className="bb-trait-grid bb-reveal">
          {traits.map((t, i) => (
            <div className="bb-trait-card" key={i}>
              <div className="bb-trait-emoji">{t.emoji}</div>
              <p className="bb-trait-name">{t.name}</p>
              <p className="bb-trait-desc">{t.desc}</p>
            </div>
          ))}
        </div>

        {/* Key phrase */}
        <div className="bb-key-phrase bb-reveal">
          <p>
            «Tu próximo lote en la zona norte está aquí.{' '}
            <span>Accesible, real y con valor que crece.</span>»
          </p>
        </div>
      </div>
    </div>
  );
}
