const mockups = [
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/tarjeta-de-presentacion',
    title: 'Tarjeta de presentación',
    desc: 'Diseño en blanco y verde con franja diagonal y logo de hoja.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/identidad-corporativa',
    title: 'Identidad corporativa completa',
    desc: 'Carpeta, sello, hoja membretada, tarjetas y sobre en una sola pieza.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/papeleria',
    title: 'Papelería / Hoja membretada',
    desc: 'Tres hojas apiladas con escudo verde y tipografía limpia.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/senalizacion-exterior',
    title: 'Señalización exterior',
    desc: 'Valla y pantalla digital de gran formato con identidad de marca.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/laptop-taza-mousepad',
    title: 'Laptop, taza y mousepad',
    desc: 'Presencia digital y merchandising con el logo en contexto real.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/tazas',
    title: 'Tazas',
    desc: 'Cerámica blanca con logo teal. Ideal para espacios de trabajo.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/gorras',
    title: 'Gorras',
    desc: 'Bordado frontal y lateral sobre gorra blanca con detalle teal.',
  },
  {
    url: 'https://res.cloudinary.com/dm4vljcnv/image/upload/f_auto,q_auto,w_1920,c_limit/ecoviva/brandbook/uniformes',
    title: 'Uniformes / Polo',
    desc: 'Polo blanco con puños verdes y logo bordado en pecho y espalda.',
  },
];

export default function ApplicationsSection() {
  return (
    <section className="bb-section" id="aplicaciones">
      <div className="bb-section-header bb-reveal">
        <p className="bb-section-label">06 — Aplicaciones</p>
        <h2 className="bb-section-title">La marca en acción</h2>
        <p className="bb-section-desc">
          Cómo la identidad EcoViva cobra vida en diferentes soportes y contextos.
        </p>
      </div>

      <div className="bb-app-photo-grid bb-reveal">
        {mockups.map((item, i) => (
          <div key={i} className="bb-app-photo-card">
            <div className="bb-app-photo-wrap">
              <img
                src={item.url}
                alt={item.title}
                className="bb-app-photo-img"
                loading="lazy"
              />
            </div>
            <div className="bb-app-card-info">
              <h4 className="bb-app-card-title">{item.title}</h4>
              <p className="bb-app-card-desc">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
