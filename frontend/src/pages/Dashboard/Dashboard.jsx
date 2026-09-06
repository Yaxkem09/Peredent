import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { pacientesService } from '../../services/pacientes.service';
import { citasService } from '../../services/citas.service';
import { Loader, EmptyState } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import './Dashboard.css';

const saludo = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

// yyyy-MM-dd en hora local (sin pasar por UTC, para no correr el día en Guatemala).
const isoLocal = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sumarDias = (fecha, n) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + n);
  return copia;
};

const fechaLargaLocal = (fecha) =>
  fecha.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });

const ESTADO_CLASE = {
  Pendiente: 'is-pendiente',
  Confirmada: 'is-confirmada',
  Atendida: 'is-atendida',
  Cancelada: 'is-cancelada',
  'No Asistio': 'is-no-asistio',
};

// "Por atender": citas que todavía no se resuelven (ni atendidas, ni canceladas, ni no-asistió).
const PENDIENTES = new Set(['Pendiente', 'Confirmada']);

const ordenarPorHora = (a, b) => (a.hora || '').localeCompare(b.hora || '');

const IconoPacientes = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <circle cx="17" cy="7" r="2.4" />
    <path d="M15 20c0-2.6 1.7-4.5 4-4.9" />
  </svg>
);

const IconoHoy = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

const IconoManana = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M12 12.5V15l1.6 1.6" />
  </svg>
);

const CitaRow = ({ cita }) => (
  <Link
    to={ROUTES.PACIENTE_DETALLE(cita.idPaciente)}
    className={`dash-cita ${ESTADO_CLASE[cita.estado] || ''}`}
    title={`Abrir expediente de ${cita.nombrePaciente || 'paciente'}`}
  >
    <span className="dash-cita-hora">{(cita.hora || '').slice(0, 5)}</span>
    <span className="dash-cita-body">
      <span className="dash-cita-nombre">{cita.nombrePaciente || 'Paciente'}</span>
      {cita.notasAdicionales ? <span className="dash-cita-nota">{cita.notasAdicionales}</span> : null}
    </span>
    <span className={`dash-cita-estado ${ESTADO_CLASE[cita.estado] || ''}`}>{cita.estado}</span>
    <svg
      className="dash-cita-arrow"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  </Link>
);

const PanelCitas = ({ titulo, citas, error, vacio }) => (
  <section className="dash-panel">
    <div className="dash-panel-head">
      <h3>{titulo}</h3>
      {!error && <span className="dash-count">{citas.length}</span>}
    </div>
    {error ? (
      <EmptyState title="Agenda no disponible" description="Aún no se pueden cargar las citas desde el servidor." />
    ) : citas.length === 0 ? (
      <EmptyState title={vacio.title} description={vacio.description} />
    ) : (
      <div className="dash-cita-list">
        {citas.map((cita) => (
          <CitaRow key={cita.idCita} cita={cita} />
        ))}
      </div>
    )}
  </section>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState({ pacientes: false, citas: false });

  const { hoy, manana, desde, hasta, etiquetaHoy, etiquetaManana } = useMemo(() => {
    const ahora = new Date();
    const dManana = sumarDias(ahora, 1);
    return {
      hoy: isoLocal(ahora),
      manana: isoLocal(dManana),
      desde: isoLocal(ahora),
      hasta: isoLocal(sumarDias(ahora, 7)),
      etiquetaHoy: fechaLargaLocal(ahora),
      etiquetaManana: fechaLargaLocal(dManana),
    };
  }, []);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      const [rPacientes, rCitas] = await Promise.allSettled([
        pacientesService.getAll(),
        citasService.getAll({ desde, hasta }),
      ]);

      if (!activo) return;

      setPacientes(rPacientes.status === 'fulfilled' ? rPacientes.value : []);
      setCitas(rCitas.status === 'fulfilled' ? rCitas.value : []);
      setErrores({
        pacientes: rPacientes.status === 'rejected',
        citas: rCitas.status === 'rejected',
      });
      setLoading(false);
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  const citasHoy = useMemo(() => citas.filter((c) => c.fecha === hoy), [citas, hoy]);
  const citasManana = useMemo(
    () => citas.filter((c) => c.fecha === manana).sort(ordenarPorHora),
    [citas, manana],
  );
  const porAtenderHoy = useMemo(
    () => citasHoy.filter((c) => PENDIENTES.has(c.estado)).sort(ordenarPorHora),
    [citasHoy],
  );

  if (loading) {
    return <Loader fullscreen label="Cargando panel..." />;
  }

  const dash = errores.citas ? '—' : undefined;
  const stats = [
    { label: 'Pacientes totales', value: errores.pacientes ? '—' : pacientes.length, icon: <IconoPacientes />, tono: 'teal' },
    { label: 'Citas de hoy', value: dash ?? citasHoy.length, icon: <IconoHoy />, tono: 'accent' },
    { label: 'Citas de mañana', value: dash ?? citasManana.length, icon: <IconoManana />, tono: 'amber' },
  ];

  return (
    <div className="dashboard page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel</div>
          <h2>
            {saludo()}
            {user?.usuario ? `, ${user.usuario}` : ''}
          </h2>
          <p>Resumen de la actividad clínica · {etiquetaHoy}</p>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card tono-${stat.tono}`}>
            <span className="stat-icon">{stat.icon}</span>
            <div className="stat-body">
              <div className="label">{stat.label}</div>
              <div className="value">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <PanelCitas
          titulo="Por atender hoy"
          citas={porAtenderHoy}
          error={errores.citas}
          vacio={{
            title: 'Nada pendiente para hoy',
            description: 'No quedan citas por atender el día de hoy.',
          }}
        />
        <PanelCitas
          titulo={`Agenda de mañana · ${etiquetaManana}`}
          citas={citasManana}
          error={errores.citas}
          vacio={{
            title: 'Sin citas para mañana',
            description: 'Todavía no hay citas programadas para mañana.',
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
