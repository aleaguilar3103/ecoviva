const principles = [
  { icon: '🎯', title: 'Seguridad y autoridad', text: 'El mensaje se comunica con certeza. No duda, no exagera, no suplica atención. Se habla desde el conocimiento del mercado y la proyección de la zona.' },
  { icon: '⏱', title: 'Enfoque en oportunidad', text: 'Cada mensaje transmite que el valor está en actuar ahora. No todos lo ven, pero quienes lo entienden, toman ventaja.' },
  { icon: '🏔', title: 'Aspiracional aterrizado', text: 'Se proyecta calidad de vida, privacidad y espacio, pero sin clichés. No se habla de "sueños", se habla de control, tranquilidad y visión a largo plazo.' },
  { icon: '🧠', title: 'Estratégico, no vendedor', text: 'No se empuja la venta directamente. Se construye una narrativa donde el cliente concluye por sí mismo que es una buena decisión.' },
  { icon: '⚡', title: 'Claridad y contundencia', text: 'Frases simples, directas y con intención. Se elimina el relleno y se prioriza el impacto.' },
];

const dos = [
  'Hablar con claridad, sin adornos innecesarios',
  'Mostrar valor real, no promesas vacías',
  'Comunicar oportunidad de forma implícita',
  'Transmitir control, tranquilidad y ventaja',
  'Frases cortas, directas y con intención',
];

const donts = [
  'Frases genéricas como "vive tu sueño"',
  'Tono exageradamente emocional o fantasioso',
  'Lenguaje técnico excesivo o complicado',
  'Mensajes que suenen a venta desesperada',
  'Explicaciones largas sin impacto',
];

const msgFlow = [
  { text: 'Contexto de crecimiento', cls: 'bb-msg-tag-teal' },
  { text: 'Beneficio tangible', cls: 'bb-msg-tag-green' },
  { text: 'Facilidad de acceso', cls: 'bb-msg-tag-teal' },
  { text: 'Oportunidad implícita', cls: 'bb-msg-tag-green' },
];

export default function VoiceSection() {
  return (
    <div className="bb-dark-section" id="voz">
      <div className="bb-section" style={{ paddingTop: '7rem', paddingBottom: '7rem' }}>
        <div className="bb-section-header bb-reveal">
          <p className="bb-section-label">04 — Tono de voz</p>
          <h2 className="bb-section-title">Cómo suena la marca</h2>
          <p className="bb-section-desc">
            Ecoviva comunica con un tono estratégico, seguro y aspiracional. No presiona ni vende de
            forma agresiva. Guía al cliente a entender que está frente a una oportunidad real.
          </p>
        </div>

        {/* Principles */}
        <div className="bb-voice-grid bb-reveal">
          {principles.map((p, i) => (
            <div className="bb-voice-card" key={i}>
              <div className="bb-voice-icon">{p.icon}</div>
              <h4 className="bb-voice-card-title">{p.title}</h4>
              <p className="bb-voice-card-text">{p.text}</p>
            </div>
          ))}
        </div>

        {/* Example quote */}
        <div className="bb-voice-example bb-reveal">
          <p className="bb-voice-example-text">
            San Carlos está creciendo hacia nuevas zonas con alto potencial. Aquí tienes lotes
            amplios de 5.000 m², en un entorno privado, sin cuotas condominales. Con financiamiento
            directo y un proceso accesible, es una decisión que combina calidad de vida con visión a
            largo plazo. Quienes están entrando ahora, lo hacen en condiciones que no se repiten.
          </p>
          <p className="bb-voice-example-label">Ejemplo de aplicación</p>
        </div>

        {/* Message structure */}
        <div className="bb-msg-structure bb-reveal">
          <p className="bb-msg-structure-title">Estructura recomendada del mensaje</p>
          <div className="bb-msg-flow">
            {msgFlow.map((item, i) => (
              <span key={i}>
                <span className={item.cls}>{item.text}</span>
                {i < msgFlow.length - 1 && <span className="bb-msg-arrow"> → </span>}
              </span>
            ))}
          </div>
        </div>

        {/* Do / Don't */}
        <div className="bb-do-dont-grid bb-reveal">
          <div className="bb-do-col">
            <h4 className="bb-do-dont-title">✓ Lo que sí</h4>
            <ul className="bb-do-dont-list">
              {dos.map((t, i) => (
                <li key={i}>
                  <span className="bb-check">✓</span> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bb-dont-col">
            <h4 className="bb-do-dont-title">✗ Lo que no</h4>
            <ul className="bb-do-dont-list">
              {donts.map((t, i) => (
                <li key={i}>
                  <span className="bb-cross">✗</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
