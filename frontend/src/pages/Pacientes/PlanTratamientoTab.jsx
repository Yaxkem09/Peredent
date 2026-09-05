import { useEffect, useMemo, useState } from 'react';
import { PIEZAS_DENTALES } from '../../utils/piezasDentales';
import { formatCurrency } from '../../utils/formatters';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { Alert, Loader, Modal } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import './PlanTratamiento.css';

const filaInicial = (pieza) => ({
  numero: pieza.numero,
  etiqueta: pieza.etiqueta,
  tratamiento: '',
  valor: 0,
});

const sumarValores = (filas) => filas.reduce((acc, fila) => acc + (Number(fila.valor) || 0), 0);

const autoResize = (el) => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

const combinarConGuardado = (piezasGuardadas) => {
  const porPieza = new Map((piezasGuardadas || []).map((p) => [p.pieza, p]));
  return PIEZAS_DENTALES.map((pieza) => {
    const guardada = porPieza.get(pieza.etiqueta);
    return {
      numero: pieza.numero,
      etiqueta: pieza.etiqueta,
      tratamiento: guardada?.tratamiento || '',
      valor: guardada?.valor || 0,
      estado: guardada?.estado || '',
    };
  });
};

const PlanTratamientoTab = ({ idPaciente }) => {
  const { notify } = useNotification();
  const [filas, setFilas] = useState(() => PIEZAS_DENTALES.map(filaInicial));
  const [descuento, setDescuento] = useState(0);
  const [guardado, setGuardado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [existePlanActivo, setExistePlanActivo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarConfirmarFinalizar, setMostrarConfirmarFinalizar] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    planTratamientoService
      .getByPaciente(idPaciente)
      .then((data) => {
        if (!activo) return;
        setFilas(combinarConGuardado(data.piezas));
        setDescuento(data.descuento || 0);
        setExistePlanActivo(Boolean(data.fechaInicio));
        setGuardado(true);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el plan de tratamiento de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const mitad = Math.ceil(filas.length / 2);
  const columnaIzquierda = filas.slice(0, mitad);
  const columnaDerecha = filas.slice(mitad);

  const subtotalIzquierda = useMemo(() => sumarValores(columnaIzquierda), [columnaIzquierda]);
  const subtotalDerecha = useMemo(() => sumarValores(columnaDerecha), [columnaDerecha]);
  const total = Math.max(subtotalIzquierda + subtotalDerecha - (Number(descuento) || 0), 0);

  const marcarCambio = () => setGuardado(false);

  const cambiarTratamiento = (numero, valor) => {
    setFilas((prev) => prev.map((f) => (f.numero === numero ? { ...f, tratamiento: valor } : f)));
    marcarCambio();
  };

  const cambiarValor = (numero, valor) => {
    setFilas((prev) =>
      prev.map((f) => (f.numero === numero ? { ...f, valor: valor === '' ? 0 : Number(valor) } : f)),
    );
    marcarCambio();
  };

  const piezasSinValor = () => filas.filter((f) => f.tratamiento.trim() !== '' && !(Number(f.valor) > 0));

  const guardar = async () => {
    setErrorGuardar(null);

    const invalidas = piezasSinValor();
    if (invalidas.length > 0) {
      const etiquetas = invalidas.map((f) => f.etiqueta).join(', ');
      setErrorGuardar(
        invalidas.length === 1
          ? `La pieza ${etiquetas} tiene un tratamiento pero no tiene un valor. Ingresa un valor mayor a 0 antes de guardar.`
          : `Las piezas ${etiquetas} tienen un tratamiento pero no tienen un valor. Ingresa un valor mayor a 0 antes de guardar.`,
      );
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        descuento: Number(descuento) || 0,
        piezas: filas.map((f) => ({
          pieza: f.etiqueta,
          tratamiento: f.tratamiento,
          valor: Number(f.valor) || 0,
        })),
      };
      const actualizado = await planTratamientoService.guardar(idPaciente, payload);
      setFilas(combinarConGuardado(actualizado.piezas));
      setDescuento(actualizado.descuento || 0);
      setExistePlanActivo(Boolean(actualizado.fechaInicio));
      setGuardado(true);
      notify('Plan de tratamiento guardado exitosamente.');
    } catch {
      setErrorGuardar('No se pudo guardar el plan de tratamiento. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarFinalizarPlan = async () => {
    setMostrarConfirmarFinalizar(false);
    setErrorGuardar(null);
    setFinalizando(true);
    try {
      await planTratamientoService.finalizar(idPaciente);
      setFilas(PIEZAS_DENTALES.map(filaInicial));
      setDescuento(0);
      setExistePlanActivo(false);
      setGuardado(true);
      notify('Plan de tratamiento finalizado. Ya puedes iniciar uno nuevo.');
    } catch {
      setErrorGuardar('No se pudo finalizar el plan de tratamiento. Intenta de nuevo.');
    } finally {
      setFinalizando(false);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  const renderTabla = (grupo, subtotalGrupo) => (
    <table className="plan-table">
      <colgroup>
        <col style={{ width: '48px' }} />
        <col />
        <col style={{ width: '92px' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Pieza</th>
          <th>Tratamiento</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {grupo.map((fila) => (
          <tr key={fila.numero}>
            <td className="plan-pieza">{fila.etiqueta}</td>
            <td>
              <textarea
                rows={1}
                className="plan-input plan-input-tratamiento"
                placeholder="Tratamiento"
                value={fila.tratamiento}
                onChange={(e) => {
                  cambiarTratamiento(fila.numero, e.target.value);
                  autoResize(e.target);
                }}
              />
              {fila.estado && (
                <span className={`tag plan-estado-tag ${fila.estado === 'Completado' ? 'tag-ok' : 'tag-pending'}`}>
                  {fila.estado}
                </span>
              )}
            </td>
            <td>
              <input
                type="number"
                min="0"
                step="100"
                className="plan-input plan-input-valor"
                placeholder="0.00"
                value={fila.valor === 0 ? '' : fila.valor}
                onChange={(e) => cambiarValor(fila.numero, e.target.value)}
              />
            </td>
          </tr>
        ))}
        <tr className="plan-subtotal-row">
          <td colSpan={2}>Sub-total</td>
          <td>{formatCurrency(subtotalGrupo)}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="plan-tratamiento">
      {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}

      <div className="plan-tablas">
        {renderTabla(columnaIzquierda, subtotalIzquierda)}
        {renderTabla(columnaDerecha, subtotalDerecha)}
      </div>

      <div className="plan-resumen">
        <div className="plan-resumen-izquierda">
          <div className="plan-descuento-field">
            <label htmlFor="plan-descuento">Descuento (Q)</label>
            <input
              id="plan-descuento"
              type="number"
              min="0"
              step="100"
              placeholder="0.00"
              value={descuento === 0 ? '' : descuento}
              onChange={(e) => {
                setDescuento(e.target.value === '' ? 0 : Number(e.target.value));
                marcarCambio();
              }}
            />
          </div>
        </div>

        <div className="plan-resumen-derecha">
          <div className="plan-total-label">Total del tratamiento</div>
          <div className="plan-total-valor">{formatCurrency(total)}</div>
        </div>
      </div>

      <div className="plan-acciones">
        <span className={`plan-estado ${guardado ? 'plan-estado-ok' : 'plan-estado-pendiente'}`}>
          {guardado ? '✓ Todo guardado' : 'Cambios sin guardar'}
        </span>
        <div className="plan-acciones-botones">
          <button
            type="button"
            className="btn btn-outline-teal btn-md"
            onClick={() => setMostrarConfirmarFinalizar(true)}
            disabled={!existePlanActivo || guardando || finalizando}
          >
            {finalizando ? 'Finalizando…' : 'Finalizar este plan'}
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={guardar} disabled={guardando || finalizando}>
            {guardando ? 'Guardando…' : 'Guardar cambios del plan'}
          </button>
        </div>
      </div>

      <Modal
        open={mostrarConfirmarFinalizar}
        onClose={() => setMostrarConfirmarFinalizar(false)}
        title="¿Finalizar este plan de tratamiento?"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 16.5h.01" />
            <path d="M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-md"
              onClick={() => setMostrarConfirmarFinalizar(false)}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-md" onClick={confirmarFinalizarPlan}>
              Sí, finalizar plan
            </button>
          </>
        }
      >
        Este plan pasará al historial y ya no se podrá editar. La próxima vez que guardes cambios se creará un plan
        nuevo en blanco.
      </Modal>
    </div>
  );
};

export default PlanTratamientoTab;
