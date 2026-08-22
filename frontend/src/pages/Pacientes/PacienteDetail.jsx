import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { historiaMedicaService } from '../../services/historia-medica.service';
import { calcularEdadTexto } from '../../utils/edad';
import { formatDate } from '../../utils/formatters';
import { Alert, Button, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import './PacienteDetail.css';

const TABS = [
  { id: 'datos', label: 'Datos y contacto' },
  { id: 'historia', label: 'Historia médica' },
  { id: 'citas', label: 'Citas' },
  { id: 'plan', label: 'Plan de tratamiento' },
  { id: 'endodoncia', label: 'Endodoncia y restauración' },
  { id: 'pendientes', label: 'Tratamiento pendiente' },
  { id: 'historial', label: 'Historial' },
  { id: 'saldo', label: 'Saldo y abonos' },
  { id: 'presupuesto', label: 'Presupuesto' },
  { id: 'fotos', label: 'Fotos panorámicas' },
  { id: 'recetario', label: 'Recetario' },
];

const TABS_DISPONIBLES = new Set(['datos', 'historia']);

const DatosTab = ({ paciente, idPaciente }) => (
  <div>
    <div className="detail-card">
      <table className="detail-table">
        <tbody>
          <tr>
            <td>Nombre completo</td>
            <td>
              {paciente.nombres} {paciente.apellidos}
            </td>
          </tr>
          <tr>
            <td>Edad</td>
            <td>
              {calcularEdadTexto(paciente.fechaNacimiento?.slice(0, 10)) || '—'} (
              {formatDate(paciente.fechaNacimiento)})
            </td>
          </tr>
          <tr>
            <td>Sexo</td>
            <td>{paciente.sexo || '—'}</td>
          </tr>
          <tr>
            <td>Teléfono</td>
            <td>{paciente.telefono || '—'}</td>
          </tr>
          <tr>
            <td>Correo</td>
            <td>{paciente.correo || '—'}</td>
          </tr>
          <tr>
            <td>Dirección</td>
            <td>{paciente.direccion || '—'}</td>
          </tr>
          {paciente.encargadoNombre && (
            <tr>
              <td>Encargado (menor de edad)</td>
              <td>
                {paciente.encargadoNombre}
                {paciente.encargadoTelefono ? ` · ${paciente.encargadoTelefono}` : ''}
              </td>
            </tr>
          )}
          <tr>
            <td>Registrado el</td>
            <td>{formatDate(paciente.fechaRegistro)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="detail-actions">
      <Link to={ROUTES.PACIENTE_EDITAR(idPaciente)} className="btn btn-secondary btn-md">
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
          <button type="button" className="btn btn-secondary btn-md" onClick={() => setEditando(true)}>
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

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'datos');

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
      <button type="button" className="breadcrumb-link" onClick={() => navigate(ROUTES.PACIENTES)}>
        ← Volver a pacientes
      </button>

      <div className="page-head">
        <div>
          <div className="eyebrow">Expediente completo</div>
          <h2>{paciente ? `${paciente.nombres} ${paciente.apellidos}` : 'Cargando…'}</h2>
          <p>Ficha, historia médica, citas, tratamientos y saldo en una sola vista.</p>
        </div>
      </div>

      {cargandoPaciente ? (
        <Loader />
      ) : errorPaciente ? (
        <Alert type="error">{errorPaciente}</Alert>
      ) : (
        <>
          <div className="tabs">
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'datos' && <DatosTab paciente={paciente} idPaciente={id} />}
          {activeTab === 'historia' && (
            <HistoriaTab historia={historia} cargando={cargandoHistoria} error={errorHistoria} idPaciente={id} />
          )}
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
