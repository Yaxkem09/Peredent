import { useEffect, useState } from 'react';
import { recetarioService } from '../../services/recetario.service';
import { pacientesService } from '../../services/pacientes.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import RecetaForm from './RecetaForm';
import RecetaDocumento from './RecetaDocumento';
import { IconPlus, IconChevronRight, IconFileText, IconSearch, IconBack } from './RecetarioIcons';
import '../../styles/page-header.css';
import './Recetario.css';

const DEMORA_BUSQUEDA_MS = 400;

const TONOS = ['teal', 'accent', 'amber'];

const esHoy = (fechaIso) => {
  const fecha = new Date(fechaIso);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate()
  );
};

// SCRUM-101: menú principal del recetario. Lista/busca recetas de todos los
// pacientes y permite crear una nueva eligiendo primero a quién es. Como usa
// los mismos endpoints y componentes (RecetaForm/RecetaDocumento) que la
// pestaña "Recetario" del expediente, una receta creada aquí ya aparece
// también en el expediente de ese paciente sin nada adicional que sincronizar.
const Recetario = () => {
  const [vista, setVista] = useState('lista'); // 'lista' | 'elegir-paciente' | 'form' | 'ver'

  const [texto, setTexto] = useState('');
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);

  const [terminoPaciente, setTerminoPaciente] = useState('');
  const [resultadosPacientes, setResultadosPacientes] = useState([]);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [pacienteElegido, setPacienteElegido] = useState(null);

  // Carga inicial (recetas más recientes de toda la clínica).
  useEffect(() => {
    let activo = true;
    setCargando(true);
    recetarioService
      .buscar('')
      .then((data) => {
        if (activo) setRecetas(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el recetario.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Búsqueda por paciente a medida que se escribe (con demora).
  useEffect(() => {
    if (!texto.trim()) return undefined;

    let activo = true;
    setBuscando(true);
    const timer = setTimeout(() => {
      recetarioService
        .buscar(texto.trim())
        .then((data) => {
          if (activo) setRecetas(data);
        })
        .catch(() => {
          if (activo) setError('No se pudo buscar en el recetario.');
        })
        .finally(() => {
          if (activo) setBuscando(false);
        });
    }, DEMORA_BUSQUEDA_MS);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [texto]);

  const cambiarTexto = (valor) => {
    setTexto(valor);
    if (!valor.trim()) {
      // Al borrar la búsqueda se vuelve a mostrar el listado reciente.
      setCargando(true);
      recetarioService
        .buscar('')
        .then(setRecetas)
        .catch(() => setError('No se pudo cargar el recetario.'))
        .finally(() => setCargando(false));
    }
  };

  // Busca pacientes a medida que se escribe, para elegir a quién es la
  // receta nueva (mismo patrón que el selector de paciente de "Nueva cita").
  useEffect(() => {
    if (vista !== 'elegir-paciente') return undefined;

    if (!terminoPaciente.trim()) {
      setResultadosPacientes([]);
      return undefined;
    }

    let activo = true;
    setBuscandoPacientes(true);
    const timer = setTimeout(() => {
      pacientesService
        .search(terminoPaciente.trim())
        .then((data) => {
          if (activo) setResultadosPacientes(data);
        })
        .catch(() => {
          if (activo) setResultadosPacientes([]);
        })
        .finally(() => {
          if (activo) setBuscandoPacientes(false);
        });
    }, DEMORA_BUSQUEDA_MS);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [terminoPaciente, vista]);

  const iniciarNuevaReceta = () => {
    setTerminoPaciente('');
    setResultadosPacientes([]);
    setPacienteElegido(null);
    setVista('elegir-paciente');
  };

  const elegirPaciente = (paciente) => {
    setPacienteElegido(paciente);
    setVista('form');
  };

  const verReceta = (receta) => {
    setRecetaSeleccionada(receta);
    setVista('ver');
  };

  const alCrear = (nueva) => {
    setRecetas((prev) => [nueva, ...prev]);
    setRecetaSeleccionada(nueva);
    setVista('ver');
  };

  const alEliminar = (idReceta) => {
    setRecetas((prev) => prev.filter((r) => r.idReceta !== idReceta));
    setVista('lista');
  };

  if (vista === 'ver' && recetaSeleccionada) {
    return (
      <div className="page-block">
        <RecetaDocumento
          receta={recetaSeleccionada}
          onVolver={() => setVista('lista')}
          onEliminada={alEliminar}
        />
      </div>
    );
  }

  if (vista === 'form' && pacienteElegido) {
    return (
      <div className="page-block">
        <div className="recetario-paciente-elegido">
          <span className="recetario-paciente-elegido-texto">
            Paciente: <strong>{pacienteElegido.nombres} {pacienteElegido.apellidos}</strong>
          </span>
          <button type="button" className="recetario-cambiar-paciente" onClick={iniciarNuevaReceta}>
            Cambiar paciente
          </button>
        </div>
        <RecetaForm
          idPaciente={pacienteElegido.id}
          nombrePaciente={`${pacienteElegido.nombres} ${pacienteElegido.apellidos}`}
          onCreada={alCrear}
          onCancelar={() => setVista('lista')}
        />
      </div>
    );
  }

  if (vista === 'elegir-paciente') {
    return (
      <div className="page-block">
        <div className="recetario-elegir-paciente">
          <button type="button" className="recetario-volver-link" onClick={() => setVista('lista')}>
            <IconBack /> Volver al recetario
          </button>

          <div className="recetario-elegir-paciente-titulo">¿Para qué paciente es la receta?</div>

          <div className="recetario-elegir-paciente-campo">
            <span className="recetario-elegir-paciente-icono">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Busca por nombre, apellido o teléfono"
              value={terminoPaciente}
              onChange={(e) => setTerminoPaciente(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          {buscandoPacientes && <p className="recetario-mensaje-sutil">Buscando…</p>}

          {!buscandoPacientes && terminoPaciente.trim() && resultadosPacientes.length === 0 && (
            <p className="recetario-mensaje-sutil">No se encontraron pacientes con ese nombre.</p>
          )}

          {resultadosPacientes.length > 0 && (
            <div className="recetario-elegir-paciente-resultados">
              {resultadosPacientes.map((p) => (
                <button
                  type="button"
                  className="recetario-elegir-paciente-item"
                  key={p.id}
                  onClick={() => elegirPaciente(p)}
                >
                  <span className="recetario-elegir-paciente-nombre">
                    {p.nombres} {p.apellidos}
                  </span>
                  <span className="recetario-elegir-paciente-detalle">{p.telefono}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-block">
      <div className="page-head">
        <div className="recetario-page-titulo">
          <span className="recetario-page-icono">
            <IconFileText />
          </span>
          <div>
            <div className="eyebrow">Recetario</div>
            <h2>Recetario</h2>
            <p>Historial de recetas emitidas a los pacientes.</p>
          </div>
        </div>
      </div>

      <div className="recetario">
        <div className="recetario-toolbar-card">
          <div className="recetario-toolbar">
            <div className="recetario-buscador">
              <span className="recetario-buscador-icono">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre, apellido o teléfono…"
                value={texto}
                onChange={(e) => cambiarTexto(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button type="button" className="btn btn-primary btn-md" onClick={iniciarNuevaReceta}>
              <IconPlus /> Nueva receta
            </button>
          </div>

          {buscando ? (
            <span className="recetario-mensaje-sutil">Buscando…</span>
          ) : (
            !cargando
            && !error
            && recetas.length > 0
            && (
              <span className="recetario-resultado-pill">
                {texto.trim()
                  ? `${recetas.length} resultado${recetas.length === 1 ? '' : 's'} para "${texto.trim()}"`
                  : `Mostrando las ${recetas.length} más recientes`}
              </span>
            )
          )}
        </div>

        {cargando ? (
          <Loader />
        ) : error ? (
          <Alert type="error">{error}</Alert>
        ) : recetas.length === 0 ? (
          <EmptyState
            icon={<IconFileText />}
            title={texto.trim() ? 'Sin resultados' : 'Sin recetas registradas'}
            description={
              texto.trim()
                ? 'No se encontraron recetas para ese paciente.'
                : 'Todavía no se ha generado ninguna receta médica.'
            }
          />
        ) : (
          <div className="recetario-lista">
            {recetas.map((r, i) => (
              <button
                type="button"
                className={`recetario-item tono-${TONOS[i % TONOS.length]}`}
                key={r.idReceta}
                onClick={() => verReceta(r)}
              >
                <span className="recetario-item-icono">
                  <IconFileText />
                </span>
                <span className="recetario-item-cuerpo">
                  <span className="recetario-item-paciente">{r.nombrePaciente}</span>
                  <span className="recetario-item-fecha">
                    {formatDate(r.fechaEmision)} · {formatTime(r.fechaEmision)}
                    {esHoy(r.fechaEmision) && <span className="recetario-badge-hoy">Hoy</span>}
                  </span>
                  <span className="recetario-item-tags">
                    {r.medicamentos.map((m, i) => (
                      <span className="recetario-tag" key={i}>
                        {m.nombre}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="recetario-item-chevron">
                  <IconChevronRight />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Recetario;
