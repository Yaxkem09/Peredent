import { REGLAS_POLITICA_VERIFICABLES } from '../../utils/politicaContrasena';
import './PoliticaContrasena.css';

// SCRUM-235: recordatorio de la política de contraseñas. Se usa al restablecer la
// contraseña y al cambiarla desde configuración (mismas reglas que el backend).
// Si se le pasa la contraseña que se está escribiendo (`clave`), marca en vivo
// cada requisito que ya se cumple.
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PoliticaContrasena = ({ titulo = 'La contraseña debe tener:', clave }) => {
  const enVivo = typeof clave === 'string';

  return (
    <div className="politica-clave">
      <span className="politica-clave-titulo">{titulo}</span>
      <ul className="politica-clave-lista">
        {REGLAS_POLITICA_VERIFICABLES.map((regla) => {
          const cumple = enVivo && regla.cumple(clave);
          return (
            <li key={regla.texto} className={cumple ? 'cumple' : undefined}>
              <span className="politica-clave-marca" aria-hidden="true">
                {cumple ? <IconCheck /> : null}
              </span>
              {regla.texto}
              {enVivo && <span className="sr-only">{cumple ? ' (cumplido)' : ' (pendiente)'}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PoliticaContrasena;
