import { useState, useCallback } from 'react';

const primaryColors = [
  { name: 'Verde Bosque', hex: '#2D6A2E', role: 'Primario' },
  { name: 'Verde Hoja', hex: '#4CAF50', role: 'Primario' },
  { name: 'Verde Claro', hex: '#7BC67E', role: 'Acento' },
  { name: 'Teal Estrategia', hex: '#1A9E96', role: 'Secundario' },
  { name: 'Teal Claro', hex: '#26C6BA', role: 'Secundario' },
];

const neutralColors = [
  { name: 'Negro Profundo', hex: '#1A1A1A', role: 'Fondos oscuros' },
  { name: 'Carbón', hex: '#333333', role: 'Texto principal' },
  { name: 'Blanco Cálido', hex: '#F5F5F0', role: 'Fondos claros', border: true },
  { name: 'Blanco', hex: '#FFFFFF', role: 'Base', border: true },
];

function ColorCard({ color, onCopy }) {
  return (
    <div className="bb-color-card" onClick={() => onCopy(color.hex)}>
      <div
        className="bb-color-swatch"
        style={{
          background: color.hex,
          border: color.border ? '1px solid #eee' : 'none',
        }}
      />
      <div className="bb-color-info">
        <p className="bb-color-name">{color.name}</p>
        <p className="bb-color-hex">{color.hex}</p>
        <p className="bb-color-role">{color.role}</p>
      </div>
    </div>
  );
}

export default function ColorSection() {
  const [toast, setToast] = useState('');

  const copyColor = useCallback((hex) => {
    navigator.clipboard.writeText(hex).then(() => {
      setToast(`${hex} copiado al portapapeles`);
      setTimeout(() => setToast(''), 2000);
    });
  }, []);

  return (
    <section className="bb-section" id="colores">
      <div className="bb-section-header bb-reveal">
        <p className="bb-section-label">02 — Paleta de colores</p>
        <h2 className="bb-section-title">Colores que comunican</h2>
        <p className="bb-section-desc">
          Los verdes representan naturaleza y crecimiento. El teal aporta modernidad y visión
          estratégica. Los neutros crean el soporte perfecto para una comunicación limpia y
          profesional.
        </p>
      </div>

      {/* Primary */}
      <div className="bb-reveal">
        <h3
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--gray-mid)',
            marginBottom: '1rem',
          }}
        >
          Colores primarios
        </h3>
        <div className="bb-color-palette">
          {primaryColors.map((c) => (
            <ColorCard key={c.hex} color={c} onCopy={copyColor} />
          ))}
        </div>
      </div>

      {/* Neutrals */}
      <div className="bb-reveal" style={{ marginTop: '2.5rem' }}>
        <h3
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--gray-mid)',
            marginBottom: '1rem',
          }}
        >
          Colores neutros
        </h3>
        <div className="bb-color-palette">
          {neutralColors.map((c) => (
            <ColorCard key={c.hex} color={c} onCopy={copyColor} />
          ))}
        </div>
      </div>

      {/* Toast */}
      <div className={`bb-toast${toast ? ' show' : ''}`}>{toast}</div>
    </section>
  );
}
