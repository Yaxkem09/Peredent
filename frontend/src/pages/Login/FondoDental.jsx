import { useEffect, useRef } from 'react';

// Siluetas del fondo del login. Todas se dibujan en vertical y el giro de
// cada elemento (más abajo) las inclina; las muelas usan su propio viewBox.
const FORMAS = {
  muela: {
    viewBox: '0 0 64 72',
    ancho: 1,
    trazo: (
      <path
        d="M32 8c-6-5-20-4-23 8-2 9 3 15 4 24 1 9 3 24 9 24 5 0 4-16 10-16s5 16 10 16c6 0 8-15 9-24 1-9 6-15 4-24C53 4 38 3 32 8z"
        fill="currentColor"
      />
    ),
  },
  // Espejo bucal: cabeza redonda + vástago + mango.
  espejo: {
    viewBox: '0 0 24 72',
    ancho: 1 / 3,
    trazo: (
      <>
        <circle cx="12" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="12" cy="10" r="5" fill="currentColor" opacity="0.45" />
        <path d="M12 18v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="9" y="30" width="6" height="40" rx="3" fill="currentColor" />
      </>
    ),
  },
  // Explorador / sonda: punta en gancho.
  explorador: {
    viewBox: '0 0 24 72',
    ancho: 1 / 3,
    trazo: (
      <>
        <path d="M12 30V12c0-7 8-9 7-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="9" y="30" width="6" height="40" rx="3" fill="currentColor" />
      </>
    ),
  },
  // Cepillo dental: cabezal con cerdas + cuello + mango.
  cepillo: {
    viewBox: '0 0 24 72',
    ancho: 1 / 3,
    trazo: (
      <>
        <rect x="8" y="4" width="10" height="16" rx="4" fill="currentColor" />
        <path d="M2 7h6M2 10.5h6M2 14h6M2 17.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="11" y="19" width="4" height="12" rx="1.5" fill="currentColor" />
        <rect x="9" y="30" width="8" height="40" rx="4" fill="currentColor" />
      </>
    ),
  },
  // Jeringa carpule: aguja, cuerpo graduado, émbolo y aletas.
  jeringa: {
    viewBox: '0 0 24 72',
    ancho: 1 / 3,
    trazo: (
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M12 1v13" strokeWidth="1.5" />
        <rect x="7" y="14" width="10" height="32" rx="2" strokeWidth="2.2" />
        <path d="M7 22h5M7 29h5M7 36h5" strokeWidth="1.6" />
        <path d="M3 47h18" strokeWidth="3" />
        <path d="M12 47v17" strokeWidth="2.4" />
        <path d="M6 66h12" strokeWidth="3.2" />
      </g>
    ),
  },
  // Pinza / fórceps: dos brazos cruzados con su pivote.
  pinza: {
    viewBox: '0 0 24 72',
    ancho: 1 / 3,
    trazo: (
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 70l8-34-3-30" />
        <path d="M19 70l-8-34 3-30" />
        <circle cx="12" cy="36" r="2.6" fill="currentColor" />
      </g>
    ),
  },
};

// Posición, tamaño (alto en px), giro y ritmo de flotación de cada elemento.
const ELEMENTOS = [
  { forma: 'muela', x: '6%', y: '12%', size: 54, dur: 9, delay: 0, giro: -14 },
  { forma: 'muela', x: '20%', y: '72%', size: 74, dur: 12, delay: -3, giro: 12 },
  { forma: 'muela', x: '34%', y: '6%', size: 40, dur: 10, delay: -6, giro: 18 },
  { forma: 'muela', x: '48%', y: '86%', size: 46, dur: 8, delay: -2, giro: -10 },
  { forma: 'muela', x: '64%', y: '4%', size: 66, dur: 13, delay: -5, giro: 10 },
  { forma: 'muela', x: '80%', y: '18%', size: 44, dur: 9, delay: -1, giro: -18 },
  { forma: 'muela', x: '90%', y: '58%', size: 78, dur: 11, delay: -7, giro: 14 },
  { forma: 'muela', x: '74%', y: '84%', size: 50, dur: 10, delay: -4, giro: -12 },
  { forma: 'muela', x: '3%', y: '46%', size: 42, dur: 12, delay: -8, giro: 16 },
  { forma: 'muela', x: '55%', y: '46%', size: 34, dur: 14, delay: -9, giro: -8 },
  { forma: 'espejo', x: '13%', y: '28%', size: 110, dur: 11, delay: -2, giro: -28 },
  { forma: 'explorador', x: '29%', y: '38%', size: 96, dur: 13, delay: -5, giro: 24 },
  { forma: 'cepillo', x: '86%', y: '32%', size: 112, dur: 12, delay: -4, giro: -22 },
  { forma: 'jeringa', x: '68%', y: '64%', size: 104, dur: 10, delay: -7, giro: 38 },
  { forma: 'pinza', x: '38%', y: '66%', size: 100, dur: 14, delay: -3, giro: -16 },
  { forma: 'espejo', x: '58%', y: '16%', size: 84, dur: 12, delay: -9, giro: 32 },
  { forma: 'explorador', x: '95%', y: '78%', size: 90, dur: 11, delay: -6, giro: -34 },
  { forma: 'cepillo', x: '9%', y: '80%', size: 96, dur: 13, delay: -1, giro: 26 },
  { forma: 'jeringa', x: '46%', y: '2%', size: 80, dur: 12, delay: -8, giro: -40 },
  { forma: 'pinza', x: '96%', y: '6%', size: 86, dur: 10, delay: -5, giro: 20 },
];

// Fondo animado del login: muelas e instrumentos flotando, con un leve
// parallax que los corre en sentido contrario al mouse (los más grandes,
// "más cerca", se mueven más).
const FondoDental = () => {
  const capaRef = useRef(null);

  useEffect(() => {
    // Se escribe directo en variables CSS para no re-renderizar en cada
    // movimiento del mouse.
    const alMover = (e) => {
      const capa = capaRef.current;
      if (!capa) return;
      capa.style.setProperty('--px', (e.clientX / window.innerWidth - 0.5).toFixed(3));
      capa.style.setProperty('--py', (e.clientY / window.innerHeight - 0.5).toFixed(3));
    };
    window.addEventListener('mousemove', alMover);
    return () => window.removeEventListener('mousemove', alMover);
  }, []);

  return (
    <div className="login-teeth" aria-hidden="true" ref={capaRef}>
      {ELEMENTOS.map((el, i) => {
        const forma = FORMAS[el.forma];
        const ancho = el.forma === 'muela' ? el.size : el.size * forma.ancho;
        return (
          <span
            key={i}
            className="login-tooth-capa"
            style={{ left: el.x, top: el.y, width: ancho, '--prof': Math.max(el.size, 40) / 25 }}
          >
            <svg
              className={`login-tooth ${el.forma === 'muela' ? '' : 'instrumento'}`.trim()}
              viewBox={forma.viewBox}
              style={{
                '--dur': `${el.dur}s`,
                animationDelay: `${el.delay}s`,
                '--giro': `${el.giro}deg`,
              }}
            >
              {forma.trazo}
            </svg>
          </span>
        );
      })}
    </div>
  );
};

export default FondoDental;
