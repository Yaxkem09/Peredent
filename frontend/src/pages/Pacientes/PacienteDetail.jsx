import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { pacientesService } from '../../services/pacientes.service';
import { historiaMedicaService } from '../../services/historia-medica.service';
import { calcularEdadTexto } from '../../utils/edad';
import { formatDate } from '../../utils/formatters';
import { Alert, Button, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import HistorialCitas from './HistorialCitas';
import PlanTratamientoTab from './PlanTratamientoTab';
import HistorialPlanesTab from './HistorialPlanesTab';
import EndodonciaTab from './EndodonciaTab';
import TratamientoPendienteTab from './TratamientoPendienteTab';
import HistorialTratamientosTab from './HistorialTratamientosTab';
import PresupuestoTab from './PresupuestoTab';
import RecetarioTab from './RecetarioTab';
import FotosPanoramicasTab from './FotosPanoramicasTab';
import '../../styles/page-header.css';
import './PacienteDetail.css';

// Íconos (trazos de 24x24) de cada pestaña del expediente.
const ICONOS_TAB = {
  datos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16.2c.7-1.7 1.9-2.5 3.2-2.5s2.5.8 3.2 2.5M14.5 10h4M14.5 13.5h3" />
    </>
  ),
  historia: (
    <>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
      <path d="M7.5 12h2.3l1.2-2 2 4 1.2-2h2.3" />
    </>
  ),
  citas: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h3M8 16.5h6" />
    </>
  ),
  plan: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  'historial-planes': (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4M12 8v4.2l3 1.8" />
    </>
  ),
  pendientes: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v2.5c0 2.2 4 3.8 4 6.5s-4 4.3-4 6.5V21M16 3v2.5c0 2.2-4 3.8-4 6.5s4 4.3 4 6.5V21" />
    </>
  ),
  historial: (
    <>
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
      <path d="M4 6.5l1.2 1.2L7.5 5.4M4 12l1.2 1.2 2.3-2.3M4 17.5l1.2 1.2 2.3-2.3" />
    </>
  ),
  endodoncia: (
    <path d="M12 4.6c-2-1.6-6.5-1.3-7.4 2.5-.6 2.9 1 4.8 1.3 7.7.3 2.9 1 7.2 2.9 7.2 1.6 0 1.3-5 3.2-5s1.6 5 3.2 5c1.9 0 2.6-4.3 2.9-7.2.3-2.9 1.9-4.8 1.3-7.7-.9-3.8-5.4-4.1-7.4-2.5z" />
  ),
  fotos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.7" />
      <path d="M21 15.5l-5-5-8.5 8.5" />
    </>
  ),
  recetario: (
    <>
      <path d="M7.5 3.5h9a1 1 0 0 1 1 1V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4.5a1 1 0 0 1 1-1Z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
    </>
  ),
  presupuesto: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </>
  ),
  saldo: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M15.5 14.5h2.5" />
    </>
  ),
};

// Pestañas agrupadas por tema, para que al abrir el expediente se ubique
// rápido cada sección (antes eran 12 pestañas sueltas en dos renglones).
const GRUPOS_TABS = [
  {
    id: 'paciente',
    label: 'Paciente',
    tabs: [
      { id: 'datos', label: 'Datos y contacto' },
      { id: 'historia', label: 'Historia médica' },
      { id: 'citas', label: 'Citas' },
    ],
  },
  {
    id: 'tratamientos',
    label: 'Tratamientos',
    tabs: [
      { id: 'plan', label: 'Plan de tratamiento' },
      { id: 'historial-planes', label: 'Historial de planes' },
      { id: 'pendientes', label: 'Tratamiento pendiente' },
      { id: 'historial', label: 'Historial' },
      { id: 'endodoncia', label: 'Endodoncia y restauración' },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    tabs: [
      { id: 'fotos', label: 'Fotos panorámicas' },
      { id: 'recetario', label: 'Recetario', hideFor: ['Asistente'] },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    tabs: [
      { id: 'presupuesto', label: 'Presupuesto' },
      { id: 'saldo', label: 'Saldo y abonos' },
    ],
  },
];

const TABS = GRUPOS_TABS.flatMap((grupo) => grupo.tabs);

const TABS_DISPONIBLES = new Set([
  'datos',
  'historia',
  'citas',
  'plan',
  'historial-planes',
  'endodoncia',
  'pendientes',
  'historial',
  'presupuesto',
  'recetario',
  'fotos',
]);

const inicialesDe = (nombres, apellidos) =>
  `${(nombres || '').charAt(0)}${(apellidos || '').charAt(0)}`.toUpperCase() || '—';

const DatosTab = ({ paciente, idPaciente }) => (
  <div>
    <div className="info-card">
      <div className="info-header">
        <div className="info-avatar">{inicialesDe(paciente.nombres, paciente.apellidos)}</div>
        <div>
          <div className="info-name">
            {paciente.nombres} {paciente.apellidos}
          </div>
          <div className="info-subtitle">
            <span className="info-badge">{calcularEdadTexto(paciente.fechaNacimiento?.slice(0, 10)) || '—'}</span>
            <span className="info-badge info-badge-sexo">{paciente.sexo || '—'}</span>
          </div>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Fecha de nacimiento</span>
          <span className="info-value">{formatDate(paciente.fechaNacimiento)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Teléfono</span>
          <span className="info-value">{paciente.telefono || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Correo</span>
          <span className="info-value">{paciente.correo || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">NIT</span>
          <span className="info-value">
            {!paciente.nit || paciente.nit.toUpperCase() === 'CF' ? 'CF (consumidor final)' : paciente.nit}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Registrado el</span>
          <span className="info-value">{formatDate(paciente.fechaRegistro)}</span>
        </div>
        <div className="info-item info-item-full">
          <span className="info-label">Dirección</span>
          <span className="info-value">{paciente.direccion || '—'}</span>
        </div>
        {paciente.encargadoNombre && (
          <div className="info-item info-item-full">
            <span className="info-label">Encargado (menor de edad)</span>
            <span className="info-value">
              {paciente.encargadoNombre}
              {paciente.encargadoTelefono ? ` · ${paciente.encargadoTelefono}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
    <div className="detail-actions">
      <Link to={ROUTES.PACIENTE_EDITAR(idPaciente)} className="btn btn-outline-teal btn-md">
        Editar datos personales
      </Link>
    </div>
  </div>
);

const HistoriaTab = ({ historia: historiaInicial, cargando, error, idPaciente }) => {
  const [editando, setEditando] = useState(false);
  const [historia, setHistoria] = useState(historiaInicial);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);

  useEffect(() => { setHistoria(historiaInicial); }, [historiaInicial]);

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!historia) return null;

  const toggleCondicion = (idCondicion) =>
    setHistoria((h) => ({
      ...h,
      condiciones: h.condiciones.map((c) =>
        c.idCondicion === idCondicion ? { ...c, marcada: !c.marcada } : c
      ),
    }));

  const cambiarObservacion = (idCondicion, valor) =>
    setHistoria((h) => ({
      ...h,
      condiciones: h.condiciones.map((c) =>
        c.idCondicion === idCondicion ? { ...c, observacion: valor } : c
      ),
    }));

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const payload = {
        observacionesGenerales: historia.observacionesGenerales,
        condiciones: historia.condiciones
          .filter((c) => c.marcada)
          .map((c) => ({ idCondicion: c.idCondicion, observacion: c.observacion || null })),
      };
      const actualizada = await historiaMedicaService.guardar(idPaciente, payload);
      setHistoria(actualizada);
      setEditando(false);
    } catch {
      setErrorGuardar('No se pudo guardar la historia médica. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => {
    setHistoria(historiaInicial);
    setEditando(false);
    setErrorGuardar(null);
  };

  if (!editando) {
    return (
      <div>
        <div className="hm-list">
          {historia.condiciones.map((condicion) => (
            <div className="hm-row" key={condicion.idCondicion}>
              <div className="hm-row-main">
                <div className="hm-row-name">
                  {condicion.idCondicion}. {condicion.nombreCondicion}
                </div>
                {condicion.marcada && condicion.observacion && (
                  <div className="hm-row-obs">{condicion.observacion}</div>
                )}
              </div>
              <span className={`tag ${condicion.marcada ? 'tag-pending' : 'tag-ok'}`}>
                {condicion.marcada ? 'Presenta' : 'Sin antecedente'}
              </span>
            </div>
          ))}
        </div>
        <div className="hm-observaciones-card">
          <div className="hm-observaciones-label">Observaciones generales</div>
          {historia.observacionesGenerales ? (
            <p className="hm-observaciones-texto">{historia.observacionesGenerales}</p>
          ) : (
            <p className="hm-observaciones-vacio">Sin observaciones adicionales.</p>
          )}
        </div>
        <div className="detail-actions">
          <button type="button" className="btn btn-outline-teal btn-md" onClick={() => setEditando(true)}>
            Editar historia médica
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}
      <div className="hm-list">
        {historia.condiciones.map((condicion) => (
          <div className="hm-row hm-row-edit" key={condicion.idCondicion}>
            <label className="hm-label-edit">
              <input
                type="checkbox"
                checked={condicion.marcada}
                onChange={() => toggleCondicion(condicion.idCondicion)}
              />
              <span className="hm-row-name">
                {condicion.idCondicion}. {condicion.nombreCondicion}
              </span>
            </label>
            {condicion.marcada && (
              <input
                className="hm-obs-input"
                type="text"
                placeholder="Observación (opcional)"
                value={condicion.observacion || ''}
                onChange={(e) => cambiarObservacion(condicion.idCondicion, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="hm-observaciones-card">
        <div className="hm-observaciones-label">Observaciones generales</div>
        <textarea
          className="hm-obs-textarea"
          rows={4}
          value={historia.observacionesGenerales || ''}
          onChange={(e) => setHistoria((h) => ({ ...h, observacionesGenerales: e.target.value }))}
          placeholder="Observaciones generales del paciente"
        />
      </div>
      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" className="btn btn-secondary btn-md" onClick={cancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

const PacienteDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // El recetario no está disponible para asistentes (igual que en el menú lateral).
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !tab.hideFor?.includes(user?.rol)),
    [user?.rol],
  );

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'datos');

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('datos');
    }
  }, [visibleTabs, activeTab]);

  const [paciente, setPaciente] = useState(null);
  const [cargandoPaciente, setCargandoPaciente] = useState(true);
  const [errorPaciente, setErrorPaciente] = useState(null);

  const [historia, setHistoria] = useState(null);
  const [cargandoHistoria, setCargandoHistoria] = useState(true);
  const [errorHistoria, setErrorHistoria] = useState(null);

  useEffect(() => {
    let activo = true;

    pacientesService
      .getById(id)
      .then((data) => {
        if (activo) setPaciente(data);
      })
      .catch(() => {
        if (activo) setErrorPaciente('No se pudo cargar el expediente de este paciente.');
      })
      .finally(() => {
        if (activo) setCargandoPaciente(false);
      });

    historiaMedicaService
      .getByPaciente(id)
      .then((data) => {
        if (activo) setHistoria(data);
      })
      .catch(() => {
        if (activo) setErrorHistoria('No se pudo cargar la historia médica de este paciente.');
      })
      .finally(() => {
        if (activo) setCargandoHistoria(false);
      });

    return () => {
      activo = false;
    };
  }, [id]);

  return (
    <div className="page-block">
      <button
        type="button"
        className="btn btn-outline-teal btn-sm detail-volver"
        onClick={() => navigate(ROUTES.PACIENTES)}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Volver a pacientes
      </button>

      <div className="page-head">
        <div>
          <div className="eyebrow">Expediente completo</div>
          <h2>{paciente ? `${paciente.nombres} ${paciente.apellidos}` : 'Cargando…'}</h2>
        </div>
      </div>

      {cargandoPaciente ? (
        <Loader />
      ) : errorPaciente ? (
        <Alert type="error">{errorPaciente}</Alert>
      ) : (
        <>
          <nav className="exp-nav" aria-label="Secciones del expediente">
            {GRUPOS_TABS.map((grupo) => {
              const tabsDelGrupo = grupo.tabs.filter((tab) => visibleTabs.some((v) => v.id === tab.id));
              if (tabsDelGrupo.length === 0) return null;
              return (
                <div className={`exp-grupo ${grupo.id}`} key={grupo.id}>
                  <div className="exp-grupo-label">{grupo.label}</div>
                  <div className="exp-grupo-tabs">
                    {tabsDelGrupo.map((tab) => (
                      <button
                        type="button"
                        key={tab.id}
                        className={`exp-tab${activeTab === tab.id ? ' active' : ''}`}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          {ICONOS_TAB[tab.id]}
                        </svg>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          {activeTab === 'datos' && <DatosTab paciente={paciente} idPaciente={id} />}
          {activeTab === 'historia' && (
            <HistoriaTab historia={historia} cargando={cargandoHistoria} error={errorHistoria} idPaciente={id} />
          )}
          {activeTab === 'citas' && <HistorialCitas idPaciente={id} />}
          {activeTab === 'plan' && <PlanTratamientoTab idPaciente={id} />}
          {activeTab === 'historial-planes' && <HistorialPlanesTab idPaciente={id} />}
          {activeTab === 'endodoncia' && <EndodonciaTab idPaciente={id} />}
          {activeTab === 'pendientes' && <TratamientoPendienteTab idPaciente={id} />}
          {activeTab === 'historial' && <HistorialTratamientosTab idPaciente={id} />}
          {activeTab === 'presupuesto' && <PresupuestoTab idPaciente={id} />}
          {activeTab === 'recetario' && <RecetarioTab idPaciente={id} paciente={paciente} />}
          {activeTab === 'fotos' && <FotosPanoramicasTab idPaciente={id} />}
          {!TABS_DISPONIBLES.has(activeTab) && (
            <EmptyState
              title="En construcción"
              description="Este apartado del expediente se implementará en una próxima historia de usuario y sprint."
              action={
                <Button variant="secondary" onClick={() => setActiveTab('datos')}>
                  Volver a datos y contacto
                </Button>
              }
            />
          )}
        </>
      )}
    </div>
  );
};

export default PacienteDetail;
