import { useEffect, useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import './TratamientoPendiente.css';

const TratamientoPendienteTab = ({ idPaciente }) => {
  const { notify } = useNotification();
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorCompletar, setErrorCompletar] = useState(null);
  const [completando, setCompletando] = useState(null);
  // Solo se listan las piezas del plan actual, así que basta ordenarlas por
  // número de pieza ("5b", "21l": número inicial y la etiqueta como desempate).
  const pendientesOrdenados = useMemo(
    () =>
      [...pendientes].sort((a, b) => {
        const na = Number.parseInt(a.pieza, 10);
        const nb = Number.parseInt(b.pieza, 10);
        if (Number.isNaN(na) || Number.isNaN(nb) || na === nb) return String(a.pieza).localeCompare(String(b.pieza));
        return na - nb;
      }),
    [pendientes],
  );

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    planTratamientoService
      .getPendientes(idPaciente)
      .then((data) => {
        if (activo) setPendientes(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el tratamiento pendiente de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const completar = async (pieza) => {
    setErrorCompletar(null);
    setCompletando(pieza);
    try {
      const actualizados = await planTratamientoService.completarPendiente(idPaciente, pieza);
      setPendientes(actualizados);
      notify(`Pieza ${pieza} marcada como completada.`);
    } catch {
      setErrorCompletar('No se pudo marcar el tratamiento como completado. Intenta de nuevo.');
    } finally {
      setCompletando(null);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (pendientes.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <path d="M9 3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V5H9V3.5Z" />
            <path d="m9 13 2 2 4-4" />
          </svg>
        }
        title="Sin tratamientos pendientes"
        description="Este paciente no tiene tratamientos pendientes en su plan de tratamiento activo."
      />
    );
  }

  const totalPendiente = pendientes.reduce((suma, p) => suma + (Number(p.valor) || 0), 0);

  return (
    <div className="tx-pendiente">
      {errorCompletar && <Alert type="error">{errorCompletar}</Alert>}

      <div className="tx-pendiente-head">
        <span className="tx-pendiente-head-icono" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3h10M7 21h10" />
            <path d="M8 3v2.5c0 2.2 4 3.8 4 6.5s-4 4.3-4 6.5V21M16 3v2.5c0 2.2-4 3.8-4 6.5s4 4.3 4 6.5V21" />
          </svg>
        </span>
        <span className="tx-pendiente-head-titulo">Tratamientos pendientes del plan actual</span>
        <span className="tx-pendiente-contador">
          {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
        </span>
        <span className="tx-pendiente-total">Por realizar: {formatCurrency(totalPendiente)}</span>
      </div>

      <table className="tx-pendiente-table">
        <thead>
          <tr>
            <th>Pieza</th>
            <th>Tratamiento</th>
            <th>Valor</th>
            <th>Fecha del plan</th>
            <th>Estado</th>
            <th aria-label="Acción" />
          </tr>
        </thead>
        <tbody>
          {pendientesOrdenados.map((p) => (
            <tr key={p.pieza}>
              <td>
                <span className="tx-pendiente-pieza">{p.pieza}</span>
              </td>
              <td className="tx-pendiente-tratamiento">{p.tratamiento}</td>
              <td>
                <span className="tx-pendiente-valor">{formatCurrency(p.valor)}</span>
              </td>
              <td>
                <span className="tx-pendiente-fecha">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3.5" y="5" width="17" height="15" rx="2" />
                    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                  </svg>
                  {formatDate(p.fechaRegistroPlan)}
                </span>
              </td>
              <td>
                <span className="tx-pendiente-estado">
                  <span className="tx-pendiente-estado-punto" aria-hidden="true" />
                  Pendiente
                </span>
              </td>
              <td className="tx-pendiente-accion">
                <button
                  type="button"
                  className="tx-completar"
                  onClick={() => completar(p.pieza)}
                  disabled={completando === p.pieza}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {completando === p.pieza ? 'Guardando…' : 'Marcar como completado'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TratamientoPendienteTab;
