import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/routes';
import { formatDate } from '../../utils/formatters';
import { citasService } from '../../services/citas.service';
import { formatearRangoHora } from '../Calendario/agenda.utils';
import { Alert, EmptyState, Loader } from '../../components/common';
import './HistorialCitas.css';

const FILTROS_INICIALES = { estado: '', desde: '', hasta: '' };

// Estado (string) que devuelve CitaDto -> modificador de clase del badge y
// de los filtros. Misma paleta que la agenda (Calendario) y su leyenda.
const CLASE_POR_ESTADO = {
  Pendiente: 'pendiente',
  Confirmada: 'confirmada',
  Atendida: 'atendida',
  Cancelada: 'cancelada',
  'No Asistio': 'no-asistio',
};

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-10-05" -> partes para el mosaico de fecha de cada fila.
const partesFecha = (iso) => {
  const [anio, mes, dia] = (iso || '').split('-');
  return { dia: Number(dia) || '—', mes: MESES_CORTO[Number(mes) - 1] || '', anio };
};

const HistorialCitas = ({ idPaciente }) => {
  const navigate = useNavigate();
  const [citas, setCitas] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [estados, setEstados] = useState([]);

  useEffect(() => {
    let activo = true;

    citasService
      .getEstados()
      .then((data) => {
        if (activo) setEstados(data);
      })
      .catch(() => {
        // El catálogo es solo para poblar el dropdown; si falla, el filtro de
        // estado simplemente queda sin opciones, no bloquea el resto del tab.
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    citasService
      .getByPaciente(idPaciente, {
        estado: filtros.estado || undefined,
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
      })
      .then((data) => {
        if (activo) setCitas(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el historial de citas de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente, filtros.estado, filtros.desde, filtros.hasta]);

  const hayFiltrosActivos = Boolean(filtros.estado || filtros.desde || filtros.hasta);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));
  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  // Abre la agenda directo en el día de la cita, en el calendario de su
  // odontólogo, con la cita resaltada (ver Calendario.jsx).
  const verEnAgenda = (cita) => {
    const params = new URLSearchParams({ fecha: cita.fecha, odontologo: cita.idUsuario, cita: cita.idCita });
    navigate(`${ROUTES.CALENDARIO}?${params}`);
  };

  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="hc">
      <div className="hc-filtros">
        <div className="hc-filtros-head">
          <span className="hc-filtros-icono" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8z" />
            </svg>
          </span>
          <span className="hc-filtros-titulo">Filtrar citas</span>
          {!cargando && (
            <span className="hc-contador">
              {citas.length} cita{citas.length === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            className="hc-limpiar"
            onClick={limpiarFiltros}
            disabled={!hayFiltrosActivos}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="hc-filtros-cuerpo">
          <div className="hc-filtro">
            <label htmlFor="hc-desde">Desde</label>
            <input
              id="hc-desde"
              type="date"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(e) => cambiarFiltro('desde', e.target.value)}
            />
          </div>

          <div className="hc-filtro">
            <label htmlFor="hc-hasta">Hasta</label>
            <input
              id="hc-hasta"
              type="date"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => cambiarFiltro('hasta', e.target.value)}
            />
          </div>

          {/* Estado como botones de color en lugar de un dropdown: se ve de un
              vistazo qué estados existen y cuál está filtrado. */}
          <div className="hc-filtro hc-filtro-estados">
            <span className="hc-filtro-label">Estado</span>
            <div className="hc-estados" role="group" aria-label="Filtrar por estado">
              <button
                type="button"
                className={`hc-chip${filtros.estado === '' ? ' activo' : ''}`}
                aria-pressed={filtros.estado === ''}
                onClick={() => cambiarFiltro('estado', '')}
              >
                Todos
              </button>
              {estados.map((estado) => (
                <button
                  type="button"
                  key={estado.id}
                  className={`hc-chip ${CLASE_POR_ESTADO[estado.nombre] || ''}${
                    filtros.estado === estado.nombre ? ' activo' : ''
                  }`}
                  aria-pressed={filtros.estado === estado.nombre}
                  onClick={() => cambiarFiltro('estado', estado.nombre)}
                >
                  <span className="hc-chip-punto" aria-hidden="true" />
                  {estado.nombre === 'No Asistio' ? 'No asistió' : estado.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {cargando ? (
        <Loader />
      ) : citas.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </svg>
          }
          title={hayFiltrosActivos ? 'Sin resultados' : 'Sin citas registradas'}
          description={
            hayFiltrosActivos
              ? 'Ninguna cita coincide con los filtros seleccionados.'
              : 'Este paciente no tiene citas registradas.'
          }
        />
      ) : (
        <table className="hc-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Odontólogo</th>
              <th>Estado</th>
              <th>Notas</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {citas.map((cita) => (
              <tr key={cita.idCita}>
                <td>
                  <div className="hc-fecha" title={formatDate(cita.fecha)}>
                    <span className="hc-fecha-dia">{partesFecha(cita.fecha).dia}</span>
                    <span className="hc-fecha-mes">
                      {partesFecha(cita.fecha).mes} {partesFecha(cita.fecha).anio}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="hc-hora">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                </td>
                <td>{cita.nombreOdontologo}</td>
                <td>
                  <span className={`hc-estado ${CLASE_POR_ESTADO[cita.estado] || ''}`}>
                    <span className="hc-chip-punto" aria-hidden="true" />
                    {cita.estado === 'No Asistio' ? 'No asistió' : cita.estado}
                  </span>
                </td>
                <td className="hc-notas">{cita.notasAdicionales || '—'}</td>
                <td className="hc-acciones">
                  <button type="button" className="hc-ver-agenda" onClick={() => verEnAgenda(cita)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3.5" y="5" width="17" height="15" rx="2" />
                      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                      <path d="M10 13.5h4M12.5 11.5l2 2-2 2" />
                    </svg>
                    Ver en agenda
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistorialCitas;
