import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import './HistorialPlanes.css';

const HistorialPlanesTab = ({ idPaciente }) => {
  const [planes, setPlanes] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    planTratamientoService
      .getHistorial(idPaciente)
      .then((data) => {
        if (activo) setPlanes(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el historial de planes de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (seleccionado) {
    return (
      <div className="historial-detalle">
        <button
          type="button"
          className="btn btn-outline-teal btn-sm historial-volver"
          onClick={() => setSeleccionado(null)}
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
          Volver al historial
        </button>

        <div className="historial-detalle-card">
          <div className="historial-detalle-head">
            <div>
              <div className="historial-detalle-fecha">Plan del {formatDate(seleccionado.fechaInicio)}</div>
              <div className="historial-detalle-sub">
                Cerrado el {formatDate(seleccionado.fechaCierre)} · {seleccionado.piezas.length} pieza(s) registradas
              </div>
            </div>
            <div className="historial-detalle-total">
              <div className="plan-total-label">Total</div>
              <div className="plan-total-valor">{formatCurrency(seleccionado.total)}</div>
            </div>
          </div>

          <table className="historial-table">
            <thead>
              <tr>
                <th>Pieza</th>
                <th>Tratamiento</th>
                <th>Valor</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {seleccionado.piezas.map((p) => (
                <tr key={p.pieza}>
                  <td className="plan-pieza">{p.pieza}</td>
                  <td>{p.tratamiento}</td>
                  <td className="historial-valor">{formatCurrency(p.valor)}</td>
                  <td>
                    <span className={`tag ${p.estado === 'Completado' ? 'tag-ok' : 'tag-pending'}`}>
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="plan-subtotal-row">
                <td colSpan={2}>Sub-total</td>
                <td>{formatCurrency(seleccionado.subtotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="historial-resumen">
            <span>Descuento aplicado: {formatCurrency(seleccionado.descuento)}</span>
          </div>

          {seleccionado.observacionesGenerales && (
            <div className="historial-observaciones">
              <div className="historial-observaciones-label">Observaciones generales</div>
              <p>{seleccionado.observacionesGenerales}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (planes.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4" />
            <path d="M3.5 4.5v4h4" />
            <path d="M12 8v4l3 2" />
          </svg>
        }
        title="Sin planes en el historial"
        description="Cuando se finalice un plan de tratamiento desde la pestaña Plan de tratamiento, va a aparecer aquí."
      />
    );
  }

  return (
    <div className="historial-lista">
      {planes.map((plan) => {
        const pendientes = plan.piezas.filter((p) => p.estado === 'Pendiente').length;
        const total = plan.piezas.length;
        const completadas = total - pendientes;
        const porcentaje = total > 0 ? Math.round((completadas * 100) / total) : 100;
        return (
          <div
            className="historial-card"
            key={plan.idPresupuestoPlan}
            role="button"
            tabIndex={0}
            onClick={() => setSeleccionado(plan)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSeleccionado(plan);
            }}
          >
            <span className="historial-card-icono" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
                <path d="M9 3h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" />
              </svg>
            </span>
            <div className="historial-card-cuerpo">
              <div className="historial-card-fecha">Plan del {formatDate(plan.fechaInicio)}</div>
              <div className="historial-card-meta">
                <span className="historial-card-total">{formatCurrency(plan.total)}</span>
                <span className="historial-card-dato">
                  {total} pieza{total === 1 ? '' : 's'}
                </span>
                <span className="historial-card-dato">Cerrado el {formatDate(plan.fechaCierre)}</span>
              </div>
              <div className="historial-progreso" aria-hidden="true">
                <div
                  className={`historial-progreso-barra${pendientes > 0 ? ' pendiente' : ''}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </div>
            <div className="historial-card-estado">
              <span className={`historial-estado${pendientes > 0 ? ' pendiente' : ' completo'}`}>
                {pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : 'Todo completado'}
              </span>
              <span className="historial-card-avance">
                {completadas} de {total} completada{total === 1 ? '' : 's'}
              </span>
            </div>
            <svg className="historial-card-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export default HistorialPlanesTab;
