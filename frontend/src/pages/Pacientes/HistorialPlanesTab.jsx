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
        <button type="button" className="breadcrumb-link" onClick={() => setSeleccionado(null)}>
          ← Volver al historial
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
        </div>
      </div>
    );
  }

  if (planes.length === 0) {
    return (
      <EmptyState
        title="Sin planes en el historial"
        description="Cuando se finalice un plan de tratamiento desde la pestaña Plan de tratamiento, va a aparecer aquí."
      />
    );
  }

  return (
    <div className="historial-lista">
      {planes.map((plan) => {
        const pendientes = plan.piezas.filter((p) => p.estado === 'Pendiente').length;
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
            <div>
              <div className="historial-card-fecha">Plan del {formatDate(plan.fechaInicio)}</div>
              <div className="historial-card-meta">
                {formatCurrency(plan.total)} · {plan.piezas.length} pieza(s) · cerrado el {formatDate(plan.fechaCierre)}
              </div>
            </div>
            <span className={`tag ${pendientes > 0 ? 'tag-pending' : 'tag-ok'}`}>
              {pendientes > 0 ? `${pendientes} pendiente(s)` : 'Todo completado'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default HistorialPlanesTab;
