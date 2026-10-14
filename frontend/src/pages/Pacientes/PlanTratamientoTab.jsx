import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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

const PlanTratamientoTab = forwardRef(({ idPaciente, onCambiarTab }, ref) => {
  const { notify } = useNotification();
  const [filas, setFilas] = useState(() => PIEZAS_DENTALES.map(filaInicial));
  const [descuento, setDescuento] = useState(0);
  const [observaciones, setObservaciones] = useState('');
  const [guardado, setGuardado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [existePlanActivo, setExistePlanActivo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarConfirmarFinalizar, setMostrarConfirmarFinalizar] = useState(false);
  const [tabPendiente, setTabPendiente] = useState(null);
  const [mostrarCambiosSinGuardar, setMostrarCambiosSinGuardar] = useState(false);

  // PacienteDetail controla el cambio de pestaña, pero antes de moverse fuera de "plan"
  // nos pregunta a través de esta ref: si no hay cambios sin guardar dejamos pasar de
  // inmediato, si los hay mostramos nuestro propio aviso en vez de perder lo escrito.
  useImperativeHandle(
    ref,
    () => ({
      intentarCambiarTab: (destino) => {
        if (guardado) {
          onCambiarTab?.(destino);
        } else {
          setTabPendiente(destino);
          setMostrarCambiosSinGuardar(true);
        }
      },
    }),
    [guardado, onCambiarTab],
  );

  // Repito el mismo aviso para el cierre/recarga del navegador (SCRUM-286): registro
  // el listener de beforeunload solo mientras haya cambios sin guardar, y lo quito en
  // cuanto guardo o se desmonta el componente.
  useEffect(() => {
    if (guardado) return undefined;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [guardado]);

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
        setObservaciones(data.observacionesGenerales || '');
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

  // Un plan solo se puede finalizar cuando todas sus piezas con tratamiento están
  // en estado "Completado"; mientras quede alguna pendiente el botón se deshabilita.
  const piezasSinCompletar = filas.filter(
    (f) => f.tratamiento.trim() !== '' && f.estado !== 'Completado',
  );
  const puedeFinalizar = existePlanActivo && piezasSinCompletar.length === 0;

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

  // Devuelvo true/false según el guardado haya tenido éxito: lo necesito para
  // decidir si "Guardar y salir" puede avanzar al cambio de pestaña o no.
  // Ya no bloqueo el guardado de una pieza con tratamiento y sin valor: se
  // guarda en 0 y queda "Pendiente de precio" hasta que se le ponga un valor.
  const guardar = async () => {
    setErrorGuardar(null);
    setGuardando(true);
    try {
      const payload = {
        descuento: Number(descuento) || 0,
        observacionesGenerales: observaciones.trim() === '' ? null : observaciones.trim(),
        piezas: filas.map((f) => ({
          pieza: f.etiqueta,
          tratamiento: f.tratamiento,
          valor: Number(f.valor) || 0,
        })),
      };
      const actualizado = await planTratamientoService.guardar(idPaciente, payload);
      setFilas(combinarConGuardado(actualizado.piezas));
      setDescuento(actualizado.descuento || 0);
      setObservaciones(actualizado.observacionesGenerales || '');
      setExistePlanActivo(Boolean(actualizado.fechaInicio));
      setGuardado(true);
      notify('Plan de tratamiento guardado exitosamente.');
      return true;
    } catch {
      setErrorGuardar('No se pudo guardar el plan de tratamiento. Intenta de nuevo.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // "Guardar y salir" del aviso de cambios sin guardar: intento guardar con la misma
  // función de siempre; solo si tuvo éxito cierro el aviso y confirmo el cambio de
  // pestaña pendiente. Si falla, dejo el aviso abierto y el error visible (arriba, en
  // el Alert ya existente) para que el usuario pueda corregir sin perder lo escrito.
  const guardarYSalirDeTab = async () => {
    const exito = await guardar();
    if (exito) {
      setMostrarCambiosSinGuardar(false);
      onCambiarTab?.(tabPendiente);
      setTabPendiente(null);
    }
  };

  // "Cancelar" del mismo aviso: nos quedamos en "plan" sin perder lo escrito.
  const cancelarCambioTab = () => {
    setMostrarCambiosSinGuardar(false);
    setTabPendiente(null);
  };

  const confirmarFinalizarPlan = async () => {
    setMostrarConfirmarFinalizar(false);
    setErrorGuardar(null);
    setFinalizando(true);
    try {
      await planTratamientoService.finalizar(idPaciente);
      setFilas(PIEZAS_DENTALES.map(filaInicial));
      setDescuento(0);
      setObservaciones('');
      setExistePlanActivo(false);
      setGuardado(true);
      notify('Plan de tratamiento finalizado. Ya puedes iniciar uno nuevo.');
    } catch (err) {
      setErrorGuardar(
        err?.response?.data?.message || 'No se pudo finalizar el plan de tratamiento. Intenta de nuevo.',
      );
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
              {/* Un tratamiento guardado sin valor (0) no es un error: lo dejo
                  claro con esta etiqueta (reutilizo el mismo estilo "tag" de la
                  columna de tratamiento), en vez de mostrar "Q0" como si fuera
                  un precio real, y el campo sigue editable para ponerlo luego. */}
              {fila.tratamiento.trim() !== '' && !(Number(fila.valor) > 0) && (
                <span className="tag plan-estado-tag tag-pending">Pendiente de precio</span>
              )}
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

      {/* Cierre del plan: observaciones a la izquierda y, a la derecha, el
          resumen de cobro (sub-total, descuento y total). */}
      <div className="plan-cierre">
        <section className="plan-card plan-observaciones-field">
          <div className="plan-card-head">
            <span className="plan-card-icono" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4.5h14a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H10l-4.5 3.5V17H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
                <path d="M8 9h8M8 12.5h5" />
              </svg>
            </span>
            <label htmlFor="plan-observaciones">Observaciones generales</label>
            <span className="plan-card-opcional">Opcional</span>
          </div>
          <textarea
            id="plan-observaciones"
            rows={4}
            placeholder="Notas relevantes sobre el tratamiento que no encajan en otros campos"
            value={observaciones}
            onChange={(e) => {
              setObservaciones(e.target.value);
              marcarCambio();
            }}
          />
        </section>

        <section className="plan-card plan-resumen">
          <div className="plan-card-head">
            <span className="plan-card-icono" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
                <path d="M9 8h6M9 12h6M9 16h3.5" />
              </svg>
            </span>
            <span className="plan-card-titulo">Resumen del plan</span>
          </div>

          <div className="plan-resumen-linea">
            <span>Sub-total</span>
            <span>{formatCurrency(subtotalIzquierda + subtotalDerecha)}</span>
          </div>

          <div className="plan-resumen-linea plan-descuento-field">
            <label htmlFor="plan-descuento">Descuento</label>
            <div className="plan-descuento-input">
              <span aria-hidden="true">− Q</span>
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

          <div className="plan-total-caja">
            <div className="plan-total-label">Total del tratamiento</div>
            <div className="plan-total-valor">{formatCurrency(total)}</div>
          </div>
        </section>
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
            disabled={!puedeFinalizar || guardando || finalizando}
            title={
              existePlanActivo && piezasSinCompletar.length > 0
                ? 'Todas las piezas deben estar completadas para finalizar el plan.'
                : undefined
            }
          >
            {finalizando ? 'Finalizando…' : 'Finalizar este plan'}
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={guardar} disabled={guardando || finalizando}>
            {guardando ? 'Guardando…' : 'Guardar cambios del plan'}
          </button>
        </div>
      </div>

      {existePlanActivo && piezasSinCompletar.length > 0 && (
        <p className="plan-finalizar-hint">
          Debes completar el tratamiento de todas las piezas para poder finalizar este plan
          {piezasSinCompletar.length === 1 ? ' (queda 1 pendiente).' : ` (quedan ${piezasSinCompletar.length} pendientes).`}
        </p>
      )}

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

      <Modal
        open={mostrarCambiosSinGuardar}
        onClose={cancelarCambioTab}
        title="Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 16.5h.01" />
            <path d="M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={cancelarCambioTab} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-md" onClick={guardarYSalirDeTab} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar y salir'}
            </button>
          </>
        }
      />
    </div>
  );
});

PlanTratamientoTab.displayName = 'PlanTratamientoTab';

export default PlanTratamientoTab;
