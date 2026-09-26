import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { citasService } from '../../services/citas.service';
import { usuariosService } from '../../services/usuarios.service';
import { bloqueosAgendaService } from '../../services/bloqueosAgenda.service';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Alert, Button, Loader } from '../../components/common';
import VistaDia from './VistaDia';
import VistaSemana from './VistaSemana';
import VistaMes from './VistaMes';
import NuevaCitaModal from './NuevaCitaModal';
import EditarCitaModal from './EditarCitaModal';
import BloqueoDiaModal from './BloqueoDiaModal';
import {
  MESES_LARGO,
  addDays,
  addMonths,
  capitalizar,
  formatearFechaCorta,
  formatearFechaLarga,
  formatearRangoHora,
  hoy,
  mondayOf,
  parseIsoDate,
  toIsoDate,
} from './agenda.utils';
import '../../styles/page-header.css';
import './Calendario.css';

const VISTAS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

const EYEBROW_POR_VISTA = {
  dia: 'Vista diaria',
  semana: 'Vista semanal',
  mes: 'Vista mensual',
};

// Recuerda, por navegador, el último odontólogo que vio un Asistente en el
// calendario -- evita tener que reelegirlo cada vez que entra a la página.
const ID_ODONTOLOGO_KEY = 'calendario_id_odontologo';

const Calendario = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  // Cada odontólogo tiene su propio calendario y el backend lo obliga a ver
  // solo el suyo; los Asistentes (y cualquier otro rol) eligen a quién ver.
  const esOdontologo = user?.rol === 'Odontologo';

  // Enlace directo a una cita desde el expediente del paciente
  // (/calendario?fecha=yyyy-MM-dd&odontologo=ID&cita=ID): abre la vista día en
  // esa fecha, con el calendario de ese odontólogo, y resalta la cita.
  const [searchParams, setSearchParams] = useSearchParams();
  const [enlaceInicial] = useState(() => ({
    fecha: searchParams.get('fecha'),
    idOdontologo: Number(searchParams.get('odontologo')) || null,
    idCita: Number(searchParams.get('cita')) || null,
  }));
  const [idCitaResaltada] = useState(enlaceInicial.idCita);

  // Una vez leídos, se quitan de la URL: si no, recargar la página o volver a
  // "Agenda" desde el menú seguiría saltando a esa cita.
  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [vista, setVista] = useState('dia');
  const [fechaActual, setFechaActual] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(enlaceInicial.fecha ?? '') ? parseIsoDate(enlaceInicial.fecha) : hoy(),
  );
  const [citas, setCitas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [odontologos, setOdontologos] = useState([]);
  const [cargandoOdontologos, setCargandoOdontologos] = useState(!esOdontologo);
  const [idOdontologoSeleccionado, setIdOdontologoSeleccionado] = useState(enlaceInicial.idOdontologo);

  const [mostrarNuevaCita, setMostrarNuevaCita] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  // fechaParaBloqueo es la fecha objetivo del modal de "marcar día no laboral":
  // en la vista día siempre es fechaActual, pero en la vista mes es el día que
  // esté seleccionado en el panel lateral (un día distinto, elegido aparte).
  const [fechaParaBloqueo, setFechaParaBloqueo] = useState(null);

  // Guardados por arrastre en curso: mientras haya alguno, el refresco
  // silencioso no pisa la posición nueva (optimista) con la vieja del servidor.
  const guardadosEnCursoRef = useRef(0);

  // Solo Asistentes (y roles sin calendario propio) necesitan la lista de
  // odontólogos para el selector; un Odontólogo siempre ve el suyo.
  useEffect(() => {
    if (esOdontologo) return;

    let activo = true;
    setCargandoOdontologos(true);

    usuariosService
      .getAll()
      .then((lista) => {
        if (!activo) return;
        const activos = lista.filter((u) => u.rol === 'Odontologo' && u.estado);
        setOdontologos(activos);
        setIdOdontologoSeleccionado((actual) => {
          if (actual && activos.some((o) => o.id === actual)) return actual;
          const guardado = Number(localStorage.getItem(ID_ODONTOLOGO_KEY));
          if (guardado && activos.some((o) => o.id === guardado)) return guardado;
          return activos[0]?.id ?? null;
        });
      })
      .catch(() => {
        if (activo) setOdontologos([]);
      })
      .finally(() => {
        if (activo) setCargandoOdontologos(false);
      });

    return () => {
      activo = false;
    };
  }, [esOdontologo]);

  const cambiarOdontologo = (id) => {
    setIdOdontologoSeleccionado(id);
    localStorage.setItem(ID_ODONTOLOGO_KEY, String(id));
  };

  const idUsuarioParaFiltrar = esOdontologo ? user?.idUsuario : idOdontologoSeleccionado;

  // Odontólogo al que le tocaría cualquier cita nueva que se cree desde acá:
  // el propio si sos Odontólogo, o el que la Asistente tiene elegido en el
  // selector -- así "+ Nueva cita" no vuelve a preguntar a quién es, ya se
  // sabe de qué calendario se está agendando.
  // Memoizado a propósito: NuevaCitaModal resetea su formulario cuando esto
  // cambia de referencia, y el refresco silencioso de citas cada 5s vuelve a
  // renderizar Calendario -- sin useMemo, un objeto literal nuevo en cada
  // render se veía como "cambió" y borraba lo que la Asistente ya había
  // escrito en el modal aunque el odontólogo fuera el mismo.
  const odontologoFijo = useMemo(() => {
    if (esOdontologo) {
      return user?.idUsuario ? { id: user.idUsuario, nombreUsuario: user.usuario } : null;
    }
    return odontologos.find((o) => o.id === idOdontologoSeleccionado) ?? null;
  }, [esOdontologo, user?.idUsuario, user?.usuario, odontologos, idOdontologoSeleccionado]);

  // Rango de fechas realmente visible en cada vista: un día, la semana
  // lunes-domingo, o la grilla de 6x7 (incluye días de meses vecinos).
  const rango = useMemo(() => {
    if (vista === 'semana') {
      const lunes = mondayOf(fechaActual);
      return { desde: lunes, hasta: addDays(lunes, 6) };
    }
    if (vista === 'mes') {
      const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
      const desde = mondayOf(primerDiaMes);
      return { desde, hasta: addDays(desde, 41) };
    }
    return { desde: fechaActual, hasta: fechaActual };
  }, [vista, fechaActual]);

  useEffect(() => {
    // Asistente sin odontólogo elegido todavía (lista aún cargando, o no hay
    // ninguno registrado): no hay de quién traer citas.
    if (!esOdontologo && !idUsuarioParaFiltrar) {
      setCitas([]);
      setBloqueos([]);
      setCargando(false);
      return undefined;
    }

    let activo = true;

    const cargarCitas = (mostrarCargando) => {
      if (!mostrarCargando && guardadosEnCursoRef.current > 0) return;

      if (mostrarCargando) {
        setCargando(true);
        setError(null);
      }

      const parametros = { desde: toIsoDate(rango.desde), hasta: toIsoDate(rango.hasta), idUsuario: idUsuarioParaFiltrar };

      Promise.all([citasService.getAll(parametros), bloqueosAgendaService.getAll(parametros)])
        .then(([citasData, bloqueosData]) => {
          if (activo) {
            setCitas(citasData);
            setBloqueos(bloqueosData);
          }
        })
        .catch(() => {
          if (activo && mostrarCargando) setError('No se pudieron cargar las citas.');
        })
        .finally(() => {
          if (activo && mostrarCargando) setCargando(false);
        });
    };

    cargarCitas(true);

    // Refresco silencioso en segundo plano: así una cita que agende o edite
    // otra cuenta (otra Asistente, o el odontólogo desde su propio celular)
    // aparece sola, sin tener que cambiar de vista o de fecha para forzarlo.
    const intervalo = setInterval(() => cargarCitas(false), 5000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [rango, esOdontologo, idUsuarioParaFiltrar]);

  const irADia = useCallback((fecha) => {
    setVista('dia');
    setFechaActual(fecha);
  }, []);

  const irAnterior = () => {
    if (vista === 'semana') setFechaActual((f) => addDays(f, -7));
    else if (vista === 'mes') setFechaActual((f) => addMonths(f, -1));
    else setFechaActual((f) => addDays(f, -1));
  };

  const irSiguiente = () => {
    if (vista === 'semana') setFechaActual((f) => addDays(f, 7));
    else if (vista === 'mes') setFechaActual((f) => addMonths(f, 1));
    else setFechaActual((f) => addDays(f, 1));
  };

  const irHoy = () => setFechaActual(hoy());

  // Después de crear/editar/cancelar una cita, saltamos a su fecha para que
  // quede visible de inmediato — esto también fuerza el refetch del rango
  // (rango depende de fechaActual, así que un Date nuevo siempre dispara el efecto de arriba).
  // Si un Asistente la agendó para un odontólogo distinto al que tenía
  // seleccionado, cambiamos también el selector: si no, la cita quedaría
  // fuera del calendario que se está viendo y parecería que no se guardó.
  const refrescarEnFechaDeCita = useCallback(
    (cita) => {
      setFechaActual(parseIsoDate(cita.fecha));
      if (!esOdontologo) cambiarOdontologo(cita.idUsuario);
    },
    [esOdontologo],
  );

  // Al soltar una cita arrastrada: se pinta de una vez en su nuevo horario y se
  // guarda con el mismo PUT del modal de edición (mismo paciente, estado y
  // notas). Si el backend lo rechaza (traslape, día bloqueado, etc.) la cita
  // vuelve a donde estaba y se muestra el motivo.
  const moverCita = useCallback(
    async (cita, { fecha, hora, duracionMinutos }) => {
      const reemplazar = (nueva) => setCitas((prev) => prev.map((c) => (c.idCita === cita.idCita ? nueva : c)));

      reemplazar({ ...cita, fecha, hora, duracionMinutos });
      guardadosEnCursoRef.current += 1;
      try {
        const actualizada = await citasService.update(cita.idCita, {
          idPaciente: cita.idPaciente,
          idUsuario: cita.idUsuario,
          fecha,
          hora,
          duracionMinutos,
          notasAdicionales: cita.notasAdicionales,
          idEstadoCita: cita.idEstadoCita,
        });
        reemplazar(actualizada);
        notify(`Cita reprogramada: ${formatearRangoHora(actualizada.hora, actualizada.duracionMinutos)}.`);
      } catch (err) {
        reemplazar(cita);
        notify(err?.response?.data?.message || 'No se pudo mover la cita.');
      } finally {
        guardadosEnCursoRef.current -= 1;
      }
    },
    [notify],
  );

  // Botón de la vista día: ahí fechaActual sí señala un único día sin
  // ambigüedad (en semana/mes es solo el ancla del rango, por eso ese botón
  // no aparece ahí -- la vista mes maneja su propio día seleccionado aparte).
  const bloqueoDelDiaActual = bloqueos.find((b) => b.fecha === toIsoDate(fechaActual));

  const abrirModalBloqueo = (fecha) => {
    setFechaParaBloqueo(fecha);
  };

  const quitarBloqueo = async (bloqueo) => {
    try {
      await bloqueosAgendaService.eliminar(bloqueo.idBloqueoAgenda);
      setBloqueos((prev) => prev.filter((b) => b.idBloqueoAgenda !== bloqueo.idBloqueoAgenda));
      notify('Bloqueo eliminado; ese día vuelve a estar disponible.');
    } catch {
      notify('No se pudo quitar el bloqueo.');
    }
  };

  const esHoy = toIsoDate(fechaActual) === toIsoDate(hoy());

  const tituloFecha =
    vista === 'semana'
      ? `Semana del ${formatearFechaCorta(rango.desde)} al ${formatearFechaCorta(rango.hasta)}`
      : vista === 'mes'
        ? `${capitalizar(MESES_LARGO[fechaActual.getMonth()])} ${fechaActual.getFullYear()}`
        : capitalizar(formatearFechaLarga(fechaActual));

  return (
    <div className="page-block agenda-page">
      <div className="page-head agenda-head">
        <div className="agenda-titulo">
          {vista === 'dia' && (
            <div className={`fecha-tile ${esHoy ? 'hoy' : ''}`.trim()} aria-hidden="true">
              <span className="fecha-tile-mes">{MESES_LARGO[fechaActual.getMonth()].slice(0, 3)}</span>
              <span className="fecha-tile-dia">{fechaActual.getDate()}</span>
            </div>
          )}
          <div>
            <div className="eyebrow">
              {EYEBROW_POR_VISTA[vista]} · {fechaActual.getFullYear()}
            </div>
            <h2 className="agenda-fecha">
              {tituloFecha}
              {esHoy && vista === 'dia' && <span className="hoy-chip">Hoy</span>}
            </h2>
          </div>
        </div>

        {/* Barra de controles siempre en su propia fila, debajo del título: así
            no salta de lugar cuando el título cambia de largo entre días. */}
        <div className="agenda-controls">
          <div className="agenda-controls-grupo">
            <div className="view-switch">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={vista === v.id ? 'active' : ''}
                  onClick={() => setVista(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="day-nav">
              <button type="button" className="nav-btn nav-btn-icono" aria-label="Anterior" onClick={irAnterior}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button type="button" className="nav-btn" onClick={irHoy}>
                Hoy
              </button>
              <button type="button" className="nav-btn nav-btn-icono" aria-label="Siguiente" onClick={irSiguiente}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              className="agenda-nueva-cita"
              disabled={!odontologoFijo}
              onClick={() => setMostrarNuevaCita(true)}
            >
              + Nueva cita
            </Button>

            {esOdontologo && vista === 'dia' && (
              <button
                type="button"
                className={`agenda-bloqueo-btn ${bloqueoDelDiaActual ? 'quitar' : ''}`.trim()}
                onClick={() =>
                  bloqueoDelDiaActual ? quitarBloqueo(bloqueoDelDiaActual) : abrirModalBloqueo(fechaActual)
                }
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" />
                  <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                  {bloqueoDelDiaActual ? <path d="M9 14.5l2 2 4-4" /> : <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" />}
                </svg>
                {bloqueoDelDiaActual ? 'Quitar bloqueo' : 'Marcar día no laboral'}
              </button>
            )}

            {/* Solo Asistentes: de qué odontólogo es la agenda que se ve (y a
                quién se le agenda con "+ Nueva cita"), por eso va junto a ese botón. */}
            {!esOdontologo && (
              <label className="odontologo-selector">
                <span className="odontologo-selector-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.4" />
                    <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
                  </svg>
                  Agenda del odontólogo
                </span>
                <select
                  className="odontologo-switch"
                  value={idOdontologoSeleccionado ?? ''}
                  onChange={(e) => cambiarOdontologo(Number(e.target.value))}
                  disabled={cargandoOdontologos || odontologos.length === 0}
                >
                  {cargandoOdontologos ? (
                    <option value="">Cargando...</option>
                  ) : odontologos.length === 0 ? (
                    <option value="">Sin odontólogos</option>
                  ) : (
                    odontologos.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombreUsuario}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {!esOdontologo && !cargandoOdontologos && odontologos.length === 0 && (
        <Alert type="error">No hay odontólogos activos registrados.</Alert>
      )}

      {cargando ? (
        <Loader />
      ) : vista === 'semana' ? (
        <VistaSemana
          fechaActual={fechaActual}
          citas={citas}
          bloqueos={bloqueos}
          onSeleccionarCita={setCitaSeleccionada}
          onMoverCita={moverCita}
        />
      ) : vista === 'mes' ? (
        <VistaMes
          fechaActual={fechaActual}
          citas={citas}
          bloqueos={bloqueos}
          esOdontologo={esOdontologo}
          onSeleccionarCita={setCitaSeleccionada}
          onVerMas={irADia}
          onMarcarBloqueo={abrirModalBloqueo}
          onQuitarBloqueo={quitarBloqueo}
        />
      ) : (
        <VistaDia
          fechaActual={fechaActual}
          citas={citas}
          bloqueos={bloqueos}
          onSeleccionarCita={setCitaSeleccionada}
          onMoverCita={moverCita}
          idCitaResaltada={idCitaResaltada}
        />
      )}

      <NuevaCitaModal
        open={mostrarNuevaCita}
        fechaInicial={fechaActual}
        odontologoFijo={odontologoFijo}
        onClose={() => setMostrarNuevaCita(false)}
        onCreada={(citaCreada) => {
          setMostrarNuevaCita(false);
          refrescarEnFechaDeCita(citaCreada);
        }}
      />

      <EditarCitaModal
        open={citaSeleccionada !== null}
        cita={citaSeleccionada}
        onClose={() => setCitaSeleccionada(null)}
        onActualizada={(citaActualizada) => {
          setCitaSeleccionada(null);
          refrescarEnFechaDeCita(citaActualizada);
        }}
        onCancelada={(citaCancelada) => {
          setCitaSeleccionada(null);
          refrescarEnFechaDeCita(citaCancelada);
        }}
      />

      <BloqueoDiaModal
        open={fechaParaBloqueo !== null}
        fecha={fechaParaBloqueo}
        onClose={() => setFechaParaBloqueo(null)}
        onCreado={(bloqueo) => {
          setFechaParaBloqueo(null);
          setBloqueos((prev) => [...prev, bloqueo]);
        }}
      />
    </div>
  );
};

export default Calendario;
