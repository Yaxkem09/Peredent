import { useEffect, useState } from 'react';
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
        title="Sin tratamientos pendientes"
        description="Este paciente no tiene tratamientos pendientes en su plan de tratamiento activo."
      />
    );
  }

  return (
    <div className="tx-pendiente">
      {errorCompletar && <Alert type="error">{errorCompletar}</Alert>}

      <table className="tx-pendiente-table">
        <thead>
          <tr>
            <th>Pieza</th>
            <th>Tratamiento</th>
            <th>Valor</th>
            <th>Fecha del plan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pendientes.map((p) => (
            <tr key={p.pieza}>
              <td className="tx-pendiente-pieza">{p.pieza}</td>
              <td>{p.tratamiento}</td>
              <td className="tx-pendiente-valor">{formatCurrency(p.valor)}</td>
              <td>{formatDate(p.fechaRegistroPlan)}</td>
              <td className="tx-pendiente-accion">
                <button
                  type="button"
                  className="btn btn-outline-teal btn-sm"
                  onClick={() => completar(p.pieza)}
                  disabled={completando === p.pieza}
                >
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
