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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;

    pacientesService
      .getAll()
      .then((data) => {
        if (activo) setPacientes(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar la lista de pacientes.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>Pacientes</h2>
          <p>Busca, registra y da seguimiento a cada expediente.</p>
        </div>
        <Link className="btn btn-primary btn-md" to={ROUTES.PACIENTE_NUEVO}>
          + Nuevo paciente
        </Link>
      </div>

      {/* Búsqueda visual únicamente; el filtrado lo implementa SCRUM-21. */}
      <input
        className="search-input"
        type="text"
        placeholder="Buscar por nombre, apellido o teléfono"
      />

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
                    {paciente.telefono || 'Sin teléfono'} · Registrado el {formatDate(paciente.fechaRegistro)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PacientesList;
