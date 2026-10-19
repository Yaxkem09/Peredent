import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TourGuiado.css';

const MARGEN_FOCO = 6;
const ANCHO_GLOBO = 330;
const SEPARACION = 14;
const BORDE_PANTALLA = 12;

const buscarElemento = (paso) => (paso ? document.querySelector(paso.selector) : null);

// Recorrido guiado: oscurece la pantalla, ilumina un elemento a la vez y muestra
// un globo con su explicación, "Anterior" / "Siguiente" y la X para salir.
// pasos: [{ selector, titulo, texto }]. Un paso cuyo elemento no está en
// pantalla (p. ej. una tabla vacía) se salta. Mientras está abierto bloquea los
// clics sobre la página, pero no la desmonta: no se pierde lo que se esté
// escribiendo. Esc cierra; las flechas del teclado avanzan y retroceden.
const TourGuiado = ({ pasos, abierto, onCerrar }) => {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState(null);
  const idTitulo = useId();
  const siguienteRef = useRef(null);

  // Pasos que existen en pantalla al abrir el recorrido.
  const [disponibles, setDisponibles] = useState([]);

  useLayoutEffect(() => {
    if (!abierto) return;
    const presentes = pasos.filter((paso) => buscarElemento(paso));
    setDisponibles(presentes);
    setIndice(0);
    if (presentes.length === 0) onCerrar();
  }, [abierto, pasos, onCerrar]);

  const paso = disponibles[indice];
  const esUltimo = indice === disponibles.length - 1;

  const medir = useCallback(() => {
    const elemento = buscarElemento(paso);
    setRect(elemento ? elemento.getBoundingClientRect() : null);
  }, [paso]);

  // Al cambiar de paso: lleva el elemento a la vista y lo mide.
  useLayoutEffect(() => {
    if (!abierto || !paso) return undefined;
    const elemento = buscarElemento(paso);
    elemento?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    medir();
    // El scroll suave tarda un poco: se vuelve a medir al terminar.
    const id = setTimeout(medir, 350);
    return () => clearTimeout(id);
  }, [abierto, paso, medir]);

  useEffect(() => {
    if (!abierto) return undefined;
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, medir]);

  const siguiente = useCallback(() => {
    if (esUltimo) onCerrar();
    else setIndice((i) => i + 1);
  }, [esUltimo, onCerrar]);

  const anterior = useCallback(() => setIndice((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (e) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowRight') siguiente();
      else if (e.key === 'ArrowLeft') anterior();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar, siguiente, anterior]);

  useEffect(() => {
    if (abierto && paso) siguienteRef.current?.focus();
  }, [abierto, paso]);

  if (!abierto || !paso) return null;

  // Globo debajo del elemento si cabe; si no, arriba. Siempre dentro de la pantalla.
  const anchoGlobo = Math.min(ANCHO_GLOBO, window.innerWidth - BORDE_PANTALLA * 2);
  const estiloGlobo = { width: anchoGlobo };
  let lado = 'abajo';
  let flechaIzquierda = 24;
  if (rect) {
    const espacioAbajo = window.innerHeight - rect.bottom;
    lado = espacioAbajo >= 200 || espacioAbajo >= rect.top ? 'abajo' : 'arriba';
    const izquierda = Math.min(
      Math.max(rect.left, BORDE_PANTALLA),
      window.innerWidth - anchoGlobo - BORDE_PANTALLA,
    );
    estiloGlobo.left = izquierda;
    if (lado === 'abajo') estiloGlobo.top = rect.bottom + MARGEN_FOCO + SEPARACION;
    else estiloGlobo.bottom = window.innerHeight - rect.top + MARGEN_FOCO + SEPARACION;
    flechaIzquierda = Math.min(Math.max(rect.left + Math.min(rect.width, 60) / 2 - izquierda, 16), anchoGlobo - 28);
  } else {
    estiloGlobo.left = '50%';
    estiloGlobo.top = '50%';
    estiloGlobo.transform = 'translate(-50%, -50%)';
  }

  return createPortal(
    <div className="tour">
      {/* Capa que bloquea los clics sobre la página mientras dura el recorrido. */}
      <div className="tour-bloqueo" aria-hidden="true" />
      {rect && (
        <div
          className="tour-foco"
          aria-hidden="true"
          style={{
            top: rect.top - MARGEN_FOCO,
            left: rect.left - MARGEN_FOCO,
            width: rect.width + MARGEN_FOCO * 2,
            height: rect.height + MARGEN_FOCO * 2,
          }}
        />
      )}
      <div
        className={`tour-globo tour-globo-${lado}`}
        style={estiloGlobo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
      >
        {rect && <span className="tour-flecha" style={{ left: flechaIzquierda }} aria-hidden="true" />}
        <button type="button" className="tour-cerrar" onClick={onCerrar} aria-label="Salir de la guía" title="Salir (Esc)">
          ×
        </button>
        <h3 className="tour-titulo" id={idTitulo}>
          {paso.titulo}
        </h3>
        <p className="tour-texto">{paso.texto}</p>
        <div className="tour-pie">
          <span className="tour-contador">
            {indice + 1} de {disponibles.length}
          </span>
          <div className="tour-botones">
            {indice > 0 && (
              <button type="button" className="tour-btn tour-btn-sec" onClick={anterior}>
                Anterior
              </button>
            )}
            <button type="button" className="tour-btn" onClick={siguiente} ref={siguienteRef}>
              {esUltimo ? 'Cerrar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TourGuiado;
