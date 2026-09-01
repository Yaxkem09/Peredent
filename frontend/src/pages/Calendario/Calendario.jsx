import { useCallback, useEffect, useMemo, useState } from 'react';
import { citasService } from '../../services/citas.service';
import { Alert, Button, Loader } from '../../components/common';
import VistaDia from './VistaDia';
import VistaSemana from './VistaSemana';
import VistaMes from './VistaMes';
import NuevaCitaModal from './NuevaCitaModal';
import EditarCitaModal from './EditarCitaModal';
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

const Calendario = () => {
  const [vista, setVista] = useState('dia');
  const [fechaActual, setFechaActual] = useState(hoy);
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarNuevaCita, setMostrarNuevaCita] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);

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
    let activo = true;
    setCargando(true);
    setError(null);

    citasService
      .getAll({ desde: toIsoDate(rango.desde), hasta: toIsoDate(rango.hasta) })
      .then((data) => {
        if (activo) setCitas(data);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar las citas.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [rango]);

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
  const refrescarEnFechaDeCita = useCallback((cita) => {
    setFechaActual(parseIsoDate(cita.fecha));
  }, []);

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
          <p>Citas confirmadas y pendientes · franja 7:00–19:00, 30 min por paciente.</p>
        </div>

        <div className="agenda-controls">
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

          <Button variant="primary" size="sm" onClick={() => setMostrarNuevaCita(true)}>
            + Nueva cita
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {cargando ? (
        <Loader />
      ) : vista === 'semana' ? (
        <VistaSemana fechaActual={fechaActual} citas={citas} onSeleccionarCita={setCitaSeleccionada} />
      ) : vista === 'mes' ? (
        <VistaMes
          fechaActual={fechaActual}
          citas={citas}
          onSeleccionarCita={setCitaSeleccionada}
          onVerMas={irADia}
        />
      ) : (
        <VistaDia fechaActual={fechaActual} citas={citas} onSeleccionarCita={setCitaSeleccionada} />
      )}

      <NuevaCitaModal
        open={mostrarNuevaCita}
        fechaInicial={fechaActual}
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
    </div>
  );
};

export default Calendario;
