import { useMemo } from 'react';
import BotonGuia from '../../components/common/BotonGuia';
import { AYUDA_EXPEDIENTE } from './ayudaExpediente';

// SCRUM-200: botón de ayuda de la pestaña activa del expediente (SCRUM-201).
// Abre un recorrido guiado por esa pestaña (SCRUM-202 / SCRUM-203): primero la
// pestaña con su resumen y después cada parte importante. Se puede cerrar en
// cualquier momento con la X o Esc sin perder lo que se esté escribiendo
// (SCRUM-204): la pestaña sigue montada debajo.
const AyudaSeccion = ({ tabId, titulo }) => {
  const ayuda = AYUDA_EXPEDIENTE[tabId];

  const pasos = useMemo(
    () =>
      ayuda
        ? [{ selector: '.exp-tab.active', titulo, texto: ayuda.resumen }, ...ayuda.pasos]
        : [],
    [ayuda, titulo],
  );

  if (!ayuda) return null;

  return (
    <div className="exp-ayuda">
      <BotonGuia pasos={pasos} etiqueta={`¿Cómo se usa “${titulo}”?`} className="exp-ayuda-boton" />
    </div>
  );
};

export default AyudaSeccion;
