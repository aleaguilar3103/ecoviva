import { useEffect, useRef, useState } from 'react';
import { LOGOS } from './logos';

const links = [
  { href: '#logo', label: 'Logo' },
  { href: '#colores', label: 'Colores' },
  { href: '#tipografia', label: 'Tipografía' },
  { href: '#voz', label: 'Voz' },
  { href: '#personalidad', label: 'Personalidad' },
  { href: '#aplicaciones', label: 'Aplicaciones' },
];

export default function Nav() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 100);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`bb-nav${hidden ? ' hidden' : ''}`}>
      <div className="bb-nav-inner">
        <img src={LOGOS.blancoHorizontal} alt="EcoViva" className="bb-nav-logo" />
        <ul className="bb-nav-links">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
