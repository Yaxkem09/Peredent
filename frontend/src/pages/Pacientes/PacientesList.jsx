import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { formatDate } from '../../utils/formatters';
import { Alert, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import './Pacientes.css';

const inicialesDe = (nombres, apellidos) =>
  `${(nombres || '').charAt(0)}${(apellidos || '').charAt(0)}`.toUpperCase() || '—';

  const PacientesList = () => {
    const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [termino, setTermino] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

useEffect(() => {
  let activo = true;
  setCargando(true);
  setError(null);

  const timer = setTimeout(() => {
    const promesa = termino.trim()
      ? pacientesService.search(termino.trim())
      : pacientesService.getAll();

    promesa
      .then((data) => { if (activo) setPacientes(data); })
      .catch(() => { if (activo) setError('No se pudo cargar la lista de pacientes.'); })
      .finally(() => { if (activo) setCargando(false); });
  }, 400);

  return () => {
    activo = false;
    clearTimeout(timer);
  };
}, [termino]);
return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>Pacientes</h2>
          <p>Busca, registra y da seguimiento a cada expediente.</p>
        </div>
        <Link className="btn btn-primary pacientes-nuevo" to={ROUTES.PACIENTE_NUEVO}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo paciente
        </Link>
      </div>

      <div className="pacientes-buscador">
        <span className="pacientes-buscador-icono" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input
          className="pacientes-buscador-input"
          type="text"
          placeholder="Buscar paciente por nombre, apellido o teléfono"
          aria-label="Buscar paciente"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
        />
        {termino && (
          <button
            type="button"
            className="pacientes-buscador-limpiar"
            onClick={() => setTermino('')}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        )}
      </div>

      {cargando ? (
        <Loader />
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : pacientes.length === 0 ? (
        <EmptyState
          title="Sin pacientes registrados"
          description="Los pacientes que registres van a aparecer en este listado."
        />
      ) : (
        <div className="patient-list">
          {pacientes.map((paciente) => (
            <div
              className="patient-row"
              key={paciente.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(ROUTES.PACIENTE_DETALLE(paciente.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(ROUTES.PACIENTE_DETALLE(paciente.id));
              }}
            >
              <div className="patient-info">
                <div className="patient-avatar">{inicialesDe(paciente.nombres, paciente.apellidos)}</div>
                <div>
                  <div className="patient-name">
                    {paciente.nombres} {paciente.apellidos}
                  </div>
                  <div className="patient-meta">
                    <span className="patient-meta-item meta-telefono">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 3.5h3.5l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3.5a1.5 1.5 0 0 1-1.6 1.5C10.5 19 5 13.5 3 6.1A1.5 1.5 0 0 1 4.5 3.5Z" />
                      </svg>
                      {paciente.telefono || 'Sin teléfono'}
                    </span>
                    <span className="patient-meta-item meta-registro">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3.5" y="5" width="17" height="15" rx="2" />
                        <path d="M3.5 9.5h17" />
                        <path d="M8 3v4M16 3v4" />
                      </svg>
                      Registrado el {formatDate(paciente.fechaRegistro)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="patient-quick-actions">
                <Link
                  to={`${ROUTES.PACIENTE_DETALLE(paciente.id)}?tab=datos`}
                  className="btn btn-ficha btn-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ficha
                </Link>
                <Link
                  to={`${ROUTES.PACIENTE_DETALLE(paciente.id)}?tab=plan`}
                  className="btn btn-plan btn-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  Plan
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PacientesList;