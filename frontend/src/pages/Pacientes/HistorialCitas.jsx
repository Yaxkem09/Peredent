import { useEffect, useState } from 'react';
import { formatDate } from '../../utils/formatters';
import { citasService } from '../../services/citas.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import './HistorialCitas.css';

const FILTROS_INICIALES = { estado: '', desde: '', hasta: '' };

// Estado (string) que devuelve CitaDto -> modificador de clase del badge.
// Misma paleta que usa la agenda (Calendario) para cada estado de cita.
const CLASE_POR_ESTADO = {
  Pendiente: 'tag-pendiente',
  Confirmada: 'tag-confirmada',
  Atendida: 'tag-atendida',
  Cancelada: 'tag-cancelada',
  'No Asistio': 'tag-no-asistio',
};

const HistorialCitas = ({ idPaciente }) => {
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

  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="hc">
      <div className="hc-filtros">
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

        <div className="hc-filtro">
          <label htmlFor="hc-estado">Estado</label>
          <select id="hc-estado" value={filtros.estado} onChange={(e) => cambiarFiltro('estado', e.target.value)}>
            <option value="">Todos</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.nombre}>
                {estado.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-outline-teal btn-sm hc-limpiar"
          onClick={limpiarFiltros}
          disabled={!hayFiltrosActivos}
        >
          Limpiar filtros
        </button>
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
            </tr>
          </thead>
          <tbody>
            {citas.map((cita) => (
              <tr key={cita.idCita}>
                <td>{formatDate(cita.fecha)}</td>
                <td>{cita.hora.slice(0, 5)}</td>
                <td>{cita.nombreOdontologo}</td>
                <td>
                  <span className={`tag ${CLASE_POR_ESTADO[cita.estado] || ''}`}>{cita.estado}</span>
                </td>
                <td className="hc-notas">{cita.notasAdicionales || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistorialCitas;
