const traits = [
  { emoji: '📊', name: 'Analítica', desc: 'Entiende hacia dónde crece la zona' },
  { emoji: '🔭', name: 'Visionaria', desc: 'Ve oportunidades antes que el mercado' },
  { emoji: '🛡', name: 'Segura', desc: 'No duda ni necesita convencer' },
  { emoji: '💎', name: 'Selectiva', desc: 'No es para todo el mundo' },
  { emoji: '⚙️', name: 'Práctica', desc: 'Elimina barreras de acceso' },
  { emoji: '🌿', name: 'Consciente', desc: 'Valora la naturaleza y el entorno' },
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
            EcoViva es un estratega del territorio: no vende terrenos, muestra dónde está la próxima
            jugada inteligente.
          </p>
        </div>

        {/* Archetype */}
        <div className="bb-archetype-banner bb-reveal">
          <div className="bb-archetype-icon">🧠</div>
          <div>
            <p className="bb-archetype-main">El Estratega</p>
            <p className="bb-archetype-sub">
              Arquetipo principal — Secundarios: 🌿 El Protector + 🏔 El Visionario
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
            «EcoViva no te vende un lote. Te muestra{' '}
            <span>dónde posicionarte</span> antes de que el mercado llegue.»
          </p>
        </div>
      </div>
    </div>
  );
}
