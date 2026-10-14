import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { panoramicasService } from '../../services/panoramicas.service';
import { Loader } from '../../components/common';

const IconDescargar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Vista previa de un documento Word (.docx) sin descargarlo: el backend
// entrega el archivo y docx-preview lo dibuja como páginas dentro del
// navegador (no se envía a ningún servicio externo). La librería se carga
// solo al abrir un documento para no agrandar el bundle principal.
const VisorDocumento = ({ documento, titulo, onCerrar }) => {
  const contenedorRef = useRef(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    Promise.all([panoramicasService.obtenerContenido(documento.id), import('docx-preview')])
      .then(async ([blob, docx]) => {
        if (!activo || !contenedorRef.current) return;
        contenedorRef.current.innerHTML = '';
        await docx.renderAsync(blob, contenedorRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
        });
      })
      .catch(() => {
        if (activo) setError('No se pudo mostrar la vista previa de este documento. Puedes descargarlo para abrirlo en Word.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [documento.id]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKeyDown);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return createPortal(
    <div className="visor-overlay" role="dialog" aria-modal="true" aria-label="Vista previa del documento" onMouseDown={onCerrar}>
      <div className="visor-barra" onMouseDown={(e) => e.stopPropagation()}>
        <span className="visor-info">{titulo}</span>
        <div className="visor-acciones">
          <a
            className="visor-boton"
            href={documento.urlFirmada}
            title="Descargar documento"
            aria-label="Descargar documento"
          >
            <IconDescargar />
          </a>
          <button type="button" className="visor-boton" onClick={onCerrar} title="Cerrar (Esc)" aria-label="Cerrar">
            <IconX />
          </button>
        </div>
      </div>

      <div className="visor-documento" onMouseDown={(e) => e.stopPropagation()}>
        {cargando && (
          <div className="visor-documento-estado">
            <Loader />
          </div>
        )}
        {error && <div className="visor-documento-estado visor-documento-error">{error}</div>}
        <div ref={contenedorRef} className="visor-documento-hojas" />
      </div>
    </div>,
    document.body,
  );
};

export default VisorDocumento;
