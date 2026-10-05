import { REGLAS_POLITICA_CONTRASENA } from '../../utils/politicaContrasena';
import './PoliticaContrasena.css';

// SCRUM-235: recordatorio de la política de contraseñas. Se usa al restablecer la
// contraseña y al cambiarla desde configuración (mismas reglas que el backend).
const PoliticaContrasena = ({ titulo = 'La contraseña debe tener:' }) => (
  <div className="politica-clave">
    <span className="politica-clave-titulo">{titulo}</span>
    <ul className="politica-clave-lista">
      {REGLAS_POLITICA_CONTRASENA.map((regla) => (
        <li key={regla}>{regla}</li>
      ))}
    </ul>
  </div>
);

export default PoliticaContrasena;
