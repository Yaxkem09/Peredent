import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const [vista, setVista] = useState('dia');
  const [fechaActual, setFechaActual] = useState(hoy);
  const [citas, setCitas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [odontologos, setOdontologos] = useState([]);
  const [cargandoOdontologos, setCargandoOdontologos] = useState(!esOdontologo);
  const [idOdontologoSeleccionado, setIdOdontologoSeleccionado] = useState(null);

  const [mostrarNuevaCita, setMostrarNuevaCita] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  // fechaParaBloqueo es la fecha objetivo del modal de "marcar día no laboral":
  // en la vista día siempre es fechaActual, pero en la vista mes es el día que
  // esté seleccionado en el panel lateral (un día distinto, elegido aparte).
  const [fechaParaBloqueo, setFechaParaBloqueo] = useState(null);

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

  const tituloFecha =
    vista === 'semana'
      ? `Semana del ${formatearFechaCorta(rango.desde)} al ${formatearFechaCorta(rango.hasta)}`
      : vista === 'mes'
        ? `${capitalizar(MESES_LARGO[fechaActual.getMonth()])} ${fechaActual.getFullYear()}`
        : capitalizar(formatearFechaLarga(fechaActual));

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">{EYEBROW_POR_VISTA[vista]}</div>
          <h2>{tituloFecha}</h2>
          <p>Citas confirmadas y pendientes · franja 7:00–19:00, citas de 30 min o 1 hora.</p>
        </div>

        <div className="agenda-controls">
          {!esOdontologo && (
            <select
              className="odontologo-switch"
              aria-label="Odontólogo"
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
          )}

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
            <Button variant="secondary" size="sm" aria-label="Anterior" onClick={irAnterior}>
              &lsaquo;
            </Button>
            <Button variant="secondary" size="sm" onClick={irHoy}>
              Hoy
            </Button>
            <Button variant="secondary" size="sm" aria-label="Siguiente" onClick={irSiguiente}>
              &rsaquo;
            </Button>
          </div>

          {esOdontologo && vista === 'dia' && (
            <Button
              variant={bloqueoDelDiaActual ? 'danger' : 'secondary'}
              size="sm"
              onClick={() =>
                bloqueoDelDiaActual ? quitarBloqueo(bloqueoDelDiaActual) : abrirModalBloqueo(fechaActual)
              }
            >
              {bloqueoDelDiaActual ? 'Quitar bloqueo' : 'Marcar día no laboral'}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            disabled={!odontologoFijo}
            onClick={() => setMostrarNuevaCita(true)}
          >
            + Nueva cita
          </Button>
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
