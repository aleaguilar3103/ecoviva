import { useEffect } from 'react';

/**
 * Observes all `.bb-reveal` elements and adds `.visible`
 * when they enter the viewport.
 */
export function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.bb-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
