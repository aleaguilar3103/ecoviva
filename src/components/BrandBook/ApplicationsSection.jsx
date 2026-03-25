const mockups = [
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c4d943dc8a198868f.jpg',
    title: 'Tarjeta de presentación',
    desc: 'Diseño en blanco y verde con franja diagonal y logo de hoja.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c39e30927a3752581.jpg',
    title: 'Identidad corporativa completa',
    desc: 'Carpeta, sello, hoja membretada, tarjetas y sobre en una sola pieza.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c51080376d3da1822.jpg',
    title: 'Papelería / Hoja membretada',
    desc: 'Tres hojas apiladas con escudo verde y tipografía limpia.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c6bd30faa07319fcf.jpg',
    title: 'Señalización exterior',
    desc: 'Valla y pantalla digital de gran formato con identidad de marca.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c7fba4b2f93d3cb65.jpg',
    title: 'Laptop, taza y mousepad',
    desc: 'Presencia digital y merchandising con el logo en contexto real.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c510803d8a8da1823.jpg',
    title: 'Tazas',
    desc: 'Cerámica blanca con logo teal. Ideal para espacios de trabajo.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c3ab4d95775c8afda.jpg',
    title: 'Gorras',
    desc: 'Bordado frontal y lateral sobre gorra blanca con detalle teal.',
  },
  {
    url: 'https://assets.cdn.filesafe.space/uLX0pzqaYQx8jI6PxNTT/media/69c30f0c6bd30f9e9c319fd0.jpg',
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
