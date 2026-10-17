import { useCallback, useState } from 'react';
import TourGuiado from './TourGuiado';

// Botón que abre el recorrido guiado de una pantalla o pestaña (SCRUM-200).
// pasos: [{ selector, titulo, texto }] (ver TourGuiado). className permite
// adaptarlo al lugar donde va (banner oscuro, barra de controles, etc.).
const BotonGuia = ({ pasos, etiqueta = 'Guía de uso', className = '' }) => {
  const [abierta, setAbierta] = useState(false);
  const cerrar = useCallback(() => setAbierta(false), []);

  return (
    <>
      <button type="button" className={`boton-guia ${className}`.trim()} onClick={() => setAbierta(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
          <path d="M12 17h.01" />
        </svg>
        {etiqueta}
      </button>
      <TourGuiado pasos={pasos} abierto={abierta} onCerrar={cerrar} />
    </>
  );
};

export default BotonGuia;
