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
import SaldoAbonosTab from './SaldoAbonosTab';
import RecetarioTab from './RecetarioTab';
import FotosPanoramicasTab from './FotosPanoramicasTab';
import ConsentimientosTab from './ConsentimientosTab';
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
  consentimientos: (
    <>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M14 3.5v5h5M8.5 13h7M8.5 16.5l1.6-1.6 1.6 1.6 1.6-1.6 1.6 1.6" />
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
      { id: 'historial', label: 'Historial de tratamientos' },
      { id: 'endodoncia', label: 'Endodoncia y restauración' },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    tabs: [
      { id: 'fotos', label: 'Radiografías/Panorámicas' },
      { id: 'recetario', label: 'Recetario', hideFor: ['Asistente'] },
      { id: 'consentimientos', label: 'Consentimientos', hideFor: ['Asistente'] },
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
  'saldo',
  'recetario',
  'fotos',
  'consentimientos',
]);

const inicialesDe = (nombres, apellidos) =>
  `${(nombres || '').charAt(0)}${(apellidos || '').charAt(0)}`.toUpperCase() || '—';

// Íconos (24x24) de cada dato de la ficha del paciente.
const ICONOS_DATO = {
  nacimiento: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  registro: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  nit: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h6M7 14h4M16.5 10v4" />
    </>
  ),
  telefono: (
    <path d="M4.5 3.5h3.5l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3.5a1.5 1.5 0 0 1-1.6 1.5C10.5 19 5 13.5 3 6.1A1.5 1.5 0 0 1 4.5 3.5Z" />
  ),
  correo: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  direccion: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  encargado: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M16 11.5a2.5 2.5 0 1 0 0-5M17.5 19c0-2.4-1-4.2-2.6-5" />
    </>
  ),
};

const Icono = ({ children, size = 17 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Un dato de la ficha: ícono + etiqueta + valor. Sin valor muestra un texto
// tenue en lugar de un guion suelto.
const Dato = ({ icono, label, valor, vacio = 'Sin registrar' }) => (
  <div className="ficha-dato">
    <span className="ficha-dato-icono">
      <Icono>{ICONOS_DATO[icono]}</Icono>
    </span>
    <div className="ficha-dato-texto">
      <span className="ficha-dato-label">{label}</span>
      {valor ? (
        <span className="ficha-dato-valor">{valor}</span>
      ) : (
        <span className="ficha-dato-valor ficha-dato-vacio">{vacio}</span>
      )}
    </div>
  </div>
);

const DatosTab = ({ paciente, idPaciente }) => {
  const sinNit = !paciente.nit || paciente.nit.toUpperCase() === 'CF';

  return (
    <div className="ficha">
      <div className="ficha-cabecera">
        <div className="ficha-avatar">{inicialesDe(paciente.nombres, paciente.apellidos)}</div>
        <div className="ficha-identidad">
          <div className="ficha-nombre">
            {paciente.nombres} {paciente.apellidos}
          </div>
          <div className="ficha-badges">
            <span className="ficha-badge">{calcularEdadTexto(paciente.fechaNacimiento?.slice(0, 10)) || '—'}</span>
            <span className="ficha-badge">{paciente.sexo || '—'}</span>
            {paciente.encargadoNombre && <span className="ficha-badge ficha-badge-menor">Menor de edad</span>}
          </div>
        </div>
        <Link to={ROUTES.PACIENTE_EDITAR(idPaciente)} className="btn btn-primary btn-md ficha-editar">
          <Icono size={16}>
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
            <path d="M13.5 6.5l4 4" />
          </Icono>
          Editar datos personales
        </Link>
      </div>

      <div className="ficha-bloques">
        <section className="ficha-bloque">
          <h4 className="ficha-bloque-titulo">Información personal</h4>
          <Dato icono="nacimiento" label="Fecha de nacimiento" valor={formatDate(paciente.fechaNacimiento)} />
          <Dato icono="nit" label="NIT" valor={sinNit ? 'CF (consumidor final)' : paciente.nit} />
          <Dato icono="registro" label="Registrado el" valor={formatDate(paciente.fechaRegistro)} />
        </section>

        <section className="ficha-bloque">
          <h4 className="ficha-bloque-titulo">Contacto</h4>
          <Dato icono="telefono" label="Teléfono" valor={paciente.telefono} />
          <Dato icono="correo" label="Correo" valor={paciente.correo} vacio="Sin correo" />
          <Dato icono="direccion" label="Dirección" valor={paciente.direccion} vacio="Sin dirección" />
        </section>

        {paciente.encargadoNombre && (
          <section className="ficha-bloque ficha-bloque-encargado">
            <h4 className="ficha-bloque-titulo">Encargado (menor de edad)</h4>
            <Dato icono="encargado" label="Nombre" valor={paciente.encargadoNombre} />
            <Dato icono="telefono" label="Teléfono" valor={paciente.encargadoTelefono} />
          </section>
        )}
      </div>
    </div>
  );
};

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

  const presentes = historia.condiciones.filter((c) => c.marcada);
  const ausentes = historia.condiciones.filter((c) => !c.marcada);

  if (!editando) {
    return (
      <div className="hm">
        <div className="hm-resumen">
          <span className={`hm-resumen-icono${presentes.length > 0 ? ' alerta' : ''}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
              <path d="M7.5 12h2.3l1.2-2 2 4 1.2-2h2.3" />
            </svg>
          </span>
          <div className="hm-resumen-texto">
            <div className="hm-resumen-titulo">
              {presentes.length === 0
                ? 'Sin antecedentes médicos'
                : `Presenta ${presentes.length} antecedente${presentes.length === 1 ? '' : 's'}`}
            </div>
            <div className="hm-resumen-sub">De {historia.condiciones.length} condiciones evaluadas</div>
          </div>
          <button type="button" className="btn btn-primary btn-md" onClick={() => setEditando(true)}>
            Editar historia médica
          </button>
        </div>

        {presentes.length > 0 && (
          <section className="hm-bloque">
            <h4 className="hm-bloque-titulo hm-bloque-titulo-alerta">Antecedentes que presenta</h4>
            <div className="hm-grid">
              {presentes.map((condicion) => (
                <div className="hm-card" key={condicion.idCondicion}>
                  <div className="hm-card-head">
                    <span className="hm-card-num">{condicion.idCondicion}</span>
                    <span className="hm-card-nombre">{condicion.nombreCondicion}</span>
                  </div>
                  {condicion.observacion && <p className="hm-card-obs">{condicion.observacion}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {ausentes.length > 0 && (
          <section className="hm-bloque">
            <h4 className="hm-bloque-titulo">Sin antecedente</h4>
            <div className="hm-chips">
              {ausentes.map((condicion) => (
                <span className="hm-chip" key={condicion.idCondicion}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {condicion.nombreCondicion}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="hm-observaciones-card">
          <div className="hm-observaciones-label">Observaciones generales</div>
          {historia.observacionesGenerales ? (
            <p className="hm-observaciones-texto">{historia.observacionesGenerales}</p>
          ) : (
            <p className="hm-observaciones-vacio">Sin observaciones adicionales.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="hm">
      {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}
      <div className="hm-resumen">
        <div className="hm-resumen-texto">
          <div className="hm-resumen-titulo">Editando historia médica</div>
          <div className="hm-resumen-sub">Marca las condiciones que presenta el paciente y agrega una observación si aplica.</div>
        </div>
      </div>
      <div className="hm-grid">
        {historia.condiciones.map((condicion) => (
          <div className={`hm-edit-card${condicion.marcada ? ' marcada' : ''}`} key={condicion.idCondicion}>
            <label className="hm-label-edit">
              <input
                type="checkbox"
                checked={condicion.marcada}
                onChange={() => toggleCondicion(condicion.idCondicion)}
              />
              <span className="hm-card-num">{condicion.idCondicion}</span>
              <span className="hm-card-nombre">{condicion.nombreCondicion}</span>
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

  // El recetario y los consentimientos no están disponibles para asistentes
  // (igual que en el menú lateral; SCRUM-256).
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
      {/* Encabezado del expediente: botón para volver y el nombre del paciente.
          Edad, teléfono, etc. ya están en la pestaña "Datos y contacto". */}
      <div className="exp-head">
        <button type="button" className="exp-volver" onClick={() => navigate(ROUTES.PACIENTES)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a pacientes
        </button>

        <h2 className="exp-head-titulo">
          <span className="exp-head-etiqueta">Paciente</span>
          <span className="exp-head-nombre">
            {paciente ? `${paciente.nombres} ${paciente.apellidos}` : 'Cargando…'}
          </span>
        </h2>
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
          {activeTab === 'saldo' && <SaldoAbonosTab idPaciente={id} />}
          {activeTab === 'recetario' && <RecetarioTab idPaciente={id} paciente={paciente} />}
          {activeTab === 'fotos' && <FotosPanoramicasTab idPaciente={id} />}
          {activeTab === 'consentimientos' && <ConsentimientosTab idPaciente={id} paciente={paciente} />}
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
