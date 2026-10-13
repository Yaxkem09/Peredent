import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { abonosService } from '../../services/abonos.service';
import { Alert, EmptyState, Loader, Modal } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import './SaldoAbonos.css';

// SCRUM-63: pestaña "Saldo y abonos" del expediente. Muestra el estado de cuenta
// del paciente (SCRUM-66): un resumen general y un bloque por plan de tratamiento
// (el activo primero). Se puede abonar a cualquier plan que tenga saldo
// pendiente, también a uno ya cerrado: terminar el tratamiento no salda la deuda.
// El saldo NO se calcula aquí: se pide al backend para que la fórmula viva en un
// solo lugar (SCRUM-65).
// Los abonos mal registrados los corrige o elimina el odontólogo, confirmando con
// su contraseña. Eliminar no borra el registro: queda tachado en "Ver eliminados"
// y deja de contar para el saldo (en el backend es la "anulación").
// DEUDA TÉCNICA: no hay límite de intentos de contraseña al editar ni historial
// de ediciones en la base (solo en el log); pendiente definir con el PO.

const mensajeError = (err, fallback) => err?.response?.data?.message || fallback;

// Saldo negativo = a favor del paciente; pasa si editan el plan después de
// haber abonado, porque el total no se congela.
const formatearSaldo = (valor) =>
  valor < 0 ? `${formatCurrency(Math.abs(valor))} a favor` : formatCurrency(valor);

// SCRUM-65: el backend rechaza un abono mayor al saldo pendiente. Se avisa
// también aquí, con el mismo criterio, para no hacer el viaje al servidor.
const avisoSaldoInsuficiente = (saldo) =>
  saldo > 0
    ? `El monto no puede ser mayor al saldo pendiente (${formatCurrency(saldo)}).`
    : 'Este plan no tiene saldo pendiente: no se pueden registrar más abonos.';

// Porcentaje pagado de un total, acotado a 0–100 para la barra de progreso.
const porcentajePagado = (abonado, total) => {
  if (total <= 0) return abonado > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((abonado / total) * 100)));
};

const Icono = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const IconTratamientos = () => (
  <Icono>
    <path d="M9 3h6l1 4H8l1-4Z" />
    <rect x="4" y="7" width="16" height="14" rx="2" />
    <path d="M9 12h6M9 16h4" />
  </Icono>
);

const IconAbonado = () => (
  <Icono>
    <path d="M20 6 9 17l-5-5" />
  </Icono>
);

const IconSaldo = () => (
  <Icono>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M15.5 14.5h2.5" />
  </Icono>
);

const IconPlanes = () => (
  <Icono>
    <path d="M4 5h16M4 12h16M4 19h10" />
  </Icono>
);

const IconCalendario = () => (
  <Icono size={15}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Icono>
);

const IconLapiz = () => (
  <Icono size={14}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icono>
);

// Fecha destacada con ícono de calendario, para que se lea de un vistazo.
const FechaChip = ({ etiqueta, fecha }) => (
  <span className="saldo-fecha-chip">
    <IconCalendario />
    <span className="saldo-fecha-chip-label">{etiqueta}</span>
    <strong>{formatDate(fecha)}</strong>
  </span>
);

const IconBasura = () => (
  <Icono size={14}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Icono>
);

const IconChevron = ({ abierto }) => (
  <svg
    className={`saldo-chevron${abierto ? ' abierto' : ''}`}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const BarraProgreso = ({ porcentaje, etiqueta }) => (
  <div className="saldo-progreso">
    <div
      className="saldo-progreso-barra"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      aria-label={etiqueta}
    >
      <span className="saldo-progreso-relleno" style={{ width: `${porcentaje}%` }} />
    </div>
    <span className="saldo-progreso-texto">{porcentaje}% pagado</span>
  </div>
);

const ListaAbonos = ({ abonos, puedeEditar, onEditar, onEliminar }) => {
  // Los anulados siguen en el historial pero arrancan ocultos, para que la tabla no
  // se llene de filas tachadas: se muestran con el interruptor.
  const [mostrarAnulados, setMostrarAnulados] = useState(false);

  const anulados = abonos.filter((abono) => abono.anulado);
  const vigentes = abonos.filter((abono) => !abono.anulado);
  const visibles = mostrarAnulados ? abonos : vigentes;

  return (
    <div className="saldo-lista">
      <div className="saldo-lista-head">
        <h4 className="saldo-lista-titulo">
          Historial de abonos
          <span className="saldo-lista-contador">{vigentes.length}</span>
        </h4>
        {anulados.length > 0 && (
          <button
            type="button"
            className="saldo-ver-anulados"
            onClick={() => setMostrarAnulados((valor) => !valor)}
          >
            {mostrarAnulados ? 'Ocultar eliminados' : `Ver eliminados (${anulados.length})`}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="saldo-vacio">
          {anulados.length > 0
            ? 'Todos los abonos de este plan fueron eliminados.'
            : 'Todavía no hay abonos registrados en este plan.'}
        </p>
      ) : (
        <div className="saldo-table-wrap">
          <table className="saldo-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="saldo-num">Monto</th>
                <th className="saldo-num">Saldo después del abono</th>
                {puedeEditar && <th className="saldo-th-acciones">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((abono) => (
                <tr key={abono.idAbonoPaciente} className={abono.anulado ? 'saldo-fila-anulada' : undefined}>
                  <td>
                    <span className="saldo-fecha">{formatDate(abono.fecha)}</span>
                    {abono.anulado && (
                      <span className="saldo-etiqueta-anulado">Eliminado {formatDate(abono.fechaAnulacion)}</span>
                    )}
                    {abono.anulado && (abono.motivoAnulacion || abono.usuarioAnulacion) && (
                      <span className="saldo-anulado-detalle">
                        {abono.motivoAnulacion && `Motivo: ${abono.motivoAnulacion}`}
                        {abono.motivoAnulacion && abono.usuarioAnulacion && ' · '}
                        {abono.usuarioAnulacion && `Eliminado por ${abono.usuarioAnulacion}`}
                      </span>
                    )}
                  </td>
                  <td className="saldo-num saldo-monto">{formatCurrency(abono.monto)}</td>
                  <td className={`saldo-num saldo-saldo${!abono.anulado && abono.saldoPendiente > 0 ? ' debe' : ''}`}>{abono.anulado ? '—' : formatearSaldo(abono.saldoPendiente)}</td>
                  {puedeEditar && (
                    <td className="saldo-acciones">
                      {!abono.anulado && (
                        <button
                          type="button"
                          className="saldo-editar"
                          onClick={() => onEditar(abono)}
                          title={`Editar el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                          aria-label={`Editar el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                        >
                          <IconLapiz />
                          Editar
                        </button>
                      )}
                      {!abono.anulado && (
                        <button
                          type="button"
                          className="saldo-eliminar"
                          onClick={() => onEliminar(abono)}
                          title={`Eliminar el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                          aria-label={`Eliminar el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                        >
                          <IconBasura />
                          Eliminar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Campo de monto en quetzales: se escribe el monto a abonar (con centavos).
// La rueda del mouse no lo cambia, para no alterar el monto sin querer.
const InputMonto = ({ id, value, onChange, disabled }) => (
  <div className="saldo-input-moneda">
    <span aria-hidden="true">Q</span>
    <input
      id={id}
      type="number"
      min="0.01"
      step="0.01"
      inputMode="decimal"
      placeholder="0.00"
      value={value}
      onChange={(evento) => onChange(evento.target.value)}
      onWheel={(evento) => evento.currentTarget.blur()}
      disabled={disabled}
      required
    />
  </div>
);

// Formulario de abono de un plan. Cada plan tiene el suyo, con su propio monto.
const FormAbono = ({ plan, onRegistrar }) => {
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const excedeSaldo = monto !== '' && Number(monto) > plan.saldo;
  const inputId = `monto-abono-${plan.idPresupuestoPlan}`;

  const enviar = async (evento) => {
    evento.preventDefault();
    if (excedeSaldo) return;

    setGuardando(true);
    const ok = await onRegistrar(plan, Number(monto));
    setGuardando(false);
    if (ok) setMonto('');
  };

  return (
    <form className="saldo-form" onSubmit={enviar}>
      <h4 className="saldo-form-titulo">Registrar abono</h4>
      {!plan.activo && (
        <p className="saldo-form-nota">Este plan ya terminó, pero todavía tiene saldo pendiente.</p>
      )}

      <div className="saldo-form-campo">
        <label htmlFor={inputId}>Monto del abono</label>
        <InputMonto id={inputId} value={monto} onChange={setMonto} disabled={guardando} />
      </div>

      <button
        type="button"
        className="saldo-chip"
        onClick={() => setMonto(plan.saldo.toFixed(2))}
        disabled={guardando}
      >
        Pagar saldo completo ({formatCurrency(plan.saldo)})
      </button>

      {excedeSaldo && <p className="saldo-aviso">{avisoSaldoInsuficiente(plan.saldo)}</p>}

      <button
        type="submit"
        className="btn btn-primary btn-md saldo-form-submit"
        disabled={guardando || monto === '' || excedeSaldo}
      >
        {guardando ? 'Registrando…' : 'Registrar abono'}
      </button>
    </form>
  );
};

const PlanCard = ({ plan, puedeModificar, onRegistrar, onEditar, onEliminar }) => {
  const pagado = plan.saldo <= 0;
  // Los planes cerrados y ya pagados arrancan colapsados: son solo historial.
  const [abierto, setAbierto] = useState(plan.activo || !pagado);

  const estadoPlan = plan.activo
    ? { clase: 'activo', texto: 'Activo' }
    : pagado
      ? { clase: 'pagado', texto: 'Cerrado · Pagado' }
      : { clase: 'pendiente', texto: 'Cerrado · Con saldo' };

  const porcentaje = porcentajePagado(plan.abonado, plan.total);

  return (
    <section className={`saldo-plan estado-${estadoPlan.clase}`}>
      <button
        type="button"
        className="saldo-plan-head"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
      >
        <div className="saldo-plan-head-info">
          <h3 className="saldo-plan-titulo">
            {plan.activo ? 'Plan de tratamiento activo' : 'Plan de tratamiento'}
          </h3>
          <div className="saldo-plan-fechas">
            <FechaChip etiqueta="Inicio" fecha={plan.fechaInicio} />
            {!plan.activo && <FechaChip etiqueta="Cierre" fecha={plan.fechaCierre} />}
          </div>
        </div>

        <div className="saldo-plan-head-meta">
          <span className={`saldo-plan-saldo${plan.saldo > 0 ? ' debe' : ''}`}>
            <span className="saldo-plan-saldo-label">Saldo</span>
            {formatearSaldo(plan.saldo)}
          </span>
          <span className={`saldo-plan-badge ${estadoPlan.clase}`}>{estadoPlan.texto}</span>
          <IconChevron abierto={abierto} />
        </div>
      </button>

      {abierto && (
        <div className="saldo-plan-body">
          <BarraProgreso porcentaje={porcentaje} etiqueta="Porcentaje pagado del plan" />

          <div className="saldo-totales">
            <div className="saldo-total-item">
              <span className="saldo-total-label">Subtotal</span>
              <span className="saldo-total-valor">{formatCurrency(plan.subtotal)}</span>
            </div>
            <div className="saldo-total-item">
              <span className="saldo-total-label">Descuento</span>
              <span className="saldo-total-valor">
                {plan.descuento > 0 ? `- ${formatCurrency(plan.descuento)}` : formatCurrency(0)}
              </span>
            </div>
            <div className="saldo-total-item">
              <span className="saldo-total-label">Total</span>
              <span className="saldo-total-valor">{formatCurrency(plan.total)}</span>
            </div>
            <div className="saldo-total-item">
              <span className="saldo-total-label">Abonado</span>
              <span className="saldo-total-valor verde">{formatCurrency(plan.abonado)}</span>
            </div>
            <div className={`saldo-total-item destacado${plan.saldo > 0 ? ' debe' : ' al-dia'}`}>
              <span className="saldo-total-label">Saldo pendiente</span>
              <span className="saldo-total-valor">{formatearSaldo(plan.saldo)}</span>
            </div>
          </div>

          <div className={`saldo-plan-grid${pagado ? ' sin-form' : ''}`}>
            {!pagado && <FormAbono plan={plan} onRegistrar={onRegistrar} />}

            <ListaAbonos
              abonos={plan.abonos}
              puedeEditar={puedeModificar}
              onEditar={(abono) => onEditar(abono, plan)}
              onEliminar={onEliminar}
            />
          </div>
        </div>
      )}
    </section>
  );
};

const SaldoAbonosTab = ({ idPaciente }) => {
  const { notify } = useNotification();
  const { user } = useAuth();
  // Solo el odontólogo puede editar o eliminar abonos (el backend exige el mismo rol).
  const puedeModificar = user?.rol === 'Odontologo';

  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Edición: abono elegido (con su plan) + nuevo monto + contraseña del admin logueado.
  const [edicion, setEdicion] = useState(null);
  const [montoEdicion, setMontoEdicion] = useState('');
  const [passwordEdicion, setPasswordEdicion] = useState('');
  const [errorEdicion, setErrorEdicion] = useState(null);
  const [editando, setEditando] = useState(false);

  // Eliminación: abono elegido + motivo opcional + contraseña del usuario logueado.
  const [abonoAEliminar, setAbonoAEliminar] = useState(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [passwordEliminar, setPasswordEliminar] = useState('');
  const [errorEliminar, setErrorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    abonosService
      .getEstadoCuentaPaciente(idPaciente)
      .then((data) => {
        if (activo) setEstado(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el estado de cuenta de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  // Devuelve true si se registró, para que el formulario limpie su monto.
  const registrar = async (plan, monto) => {
    if (monto > plan.saldo) {
      notify(avisoSaldoInsuficiente(plan.saldo));
      return false;
    }

    try {
      await abonosService.registrar(idPaciente, monto, plan.idPresupuestoPlan);
      // El saldo se vuelve a pedir para mostrar el recálculo del backend en vez
      // de calcularlo en el cliente.
      setEstado(await abonosService.getEstadoCuentaPaciente(idPaciente));
      notify('Abono registrado exitosamente.');
      return true;
    } catch (err) {
      notify(mensajeError(err, 'No se pudo registrar el abono. Intenta de nuevo.'));
      return false;
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!estado) return null;

  const abrirEdicion = (abono, plan) => {
    setEdicion({ abono, plan });
    setMontoEdicion(String(abono.monto));
    setPasswordEdicion('');
    setErrorEdicion(null);
  };

  const cerrarEdicion = () => {
    setEdicion(null);
    setMontoEdicion('');
    setPasswordEdicion('');
    setErrorEdicion(null);
  };

  const abrirEliminacion = (abono) => {
    setAbonoAEliminar(abono);
    setMotivoEliminar('');
    setPasswordEliminar('');
    setErrorEliminar(null);
  };

  const cerrarEliminacion = () => {
    if (eliminando) return;
    setAbonoAEliminar(null);
    setMotivoEliminar('');
    setPasswordEliminar('');
    setErrorEliminar(null);
  };

  const confirmarEliminacion = async (evento) => {
    evento.preventDefault();
    if (!abonoAEliminar) return;

    setEliminando(true);
    setErrorEliminar(null);
    try {
      await abonosService.anular(idPaciente, abonoAEliminar.idAbonoPaciente, passwordEliminar, motivoEliminar);
      setEstado(await abonosService.getEstadoCuentaPaciente(idPaciente));
      setAbonoAEliminar(null);
      notify('Abono eliminado: ya no cuenta para el saldo del plan.');
    } catch (err) {
      setErrorEliminar(mensajeError(err, 'No se pudo eliminar el abono. Intenta de nuevo.'));
    } finally {
      setEliminando(false);
    }
  };

  // Lo máximo que puede valer el abono: lo que queda por pagar más lo que ya vale.
  const maximoEdicion = edicion ? Math.max(0, edicion.plan.saldo + edicion.abono.monto) : 0;
  const excedeEdicion =
    Boolean(edicion) &&
    montoEdicion !== '' &&
    Number(montoEdicion) > edicion.abono.monto &&
    Number(montoEdicion) > maximoEdicion;

  const confirmarEdicion = async (evento) => {
    evento.preventDefault();
    if (!edicion || excedeEdicion) return;

    setEditando(true);
    setErrorEdicion(null);
    try {
      await abonosService.editar(idPaciente, edicion.abono.idAbonoPaciente, Number(montoEdicion), passwordEdicion);
      // Resumen, lista y saldo se refrescan con lo que calculó el backend.
      setEstado(await abonosService.getEstadoCuentaPaciente(idPaciente));
      cerrarEdicion();
      notify('Abono actualizado: el saldo se recalculó con el nuevo monto.');
    } catch (err) {
      // El mensaje del backend se muestra dentro del modal, sin cerrarlo.
      setErrorEdicion(mensajeError(err, 'No se pudo editar el abono. Intenta de nuevo.'));
    } finally {
      setEditando(false);
    }
  };

  if (!estado.tienePlanes) {
    return (
      <EmptyState
        icon={<IconSaldo />}
        title="El paciente todavía no tiene plan de tratamiento"
        description="El saldo se calcula contra el total del plan de tratamiento. En cuanto se registre uno desde la pestaña Plan de tratamiento, vas a poder registrar abonos acá."
      />
    );
  }

  const { resumen } = estado;
  const saldoAFavor = resumen.saldoPendiente < 0;
  const porcentajeGeneral = porcentajePagado(resumen.totalAbonado, resumen.totalTratamientos);

  return (
    <div className="saldo">
      <div className="saldo-resumen">
        <div className="saldo-resumen-item">
          <span className="saldo-resumen-icono"><IconTratamientos /></span>
          <div className="saldo-resumen-texto">
            <span className="saldo-resumen-label">Total en tratamientos</span>
            <span className="saldo-resumen-valor">{formatCurrency(resumen.totalTratamientos)}</span>
          </div>
        </div>

        <div className="saldo-resumen-item">
          <span className="saldo-resumen-icono verde"><IconAbonado /></span>
          <div className="saldo-resumen-texto">
            <span className="saldo-resumen-label">Total abonado</span>
            <span className="saldo-resumen-valor">{formatCurrency(resumen.totalAbonado)}</span>
          </div>
        </div>

        <div className={`saldo-resumen-item destacado${saldoAFavor || resumen.saldoPendiente === 0 ? ' al-dia' : ''}`}>
          <span className="saldo-resumen-icono"><IconSaldo /></span>
          <div className="saldo-resumen-texto">
            <span className="saldo-resumen-label">{saldoAFavor ? 'Saldo a favor' : 'Saldo pendiente'}</span>
            <span className="saldo-resumen-valor">{formatCurrency(Math.abs(resumen.saldoPendiente))}</span>
          </div>
        </div>

        <div className="saldo-resumen-item">
          <span className="saldo-resumen-icono"><IconPlanes /></span>
          <div className="saldo-resumen-texto">
            <span className="saldo-resumen-label">Planes de tratamiento</span>
            <span className="saldo-resumen-valor">{resumen.totalPlanes}</span>
          </div>
        </div>

        <div className="saldo-resumen-progreso">
          <BarraProgreso porcentaje={porcentajeGeneral} etiqueta="Porcentaje pagado de todos los planes" />
        </div>
      </div>

      {estado.planes.map((plan) => (
        <PlanCard
          key={plan.idPresupuestoPlan}
          plan={plan}
          puedeModificar={puedeModificar}
          onRegistrar={registrar}
          onEditar={abrirEdicion}
          onEliminar={abrirEliminacion}
        />
      ))}

      <Modal
        open={Boolean(edicion)}
        onClose={() => !editando && cerrarEdicion()}
        title="Editar abono"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={cerrarEdicion} disabled={editando}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-editar-abono"
              className="btn btn-primary btn-md"
              disabled={editando || passwordEdicion === '' || montoEdicion === '' || Number(montoEdicion) <= 0 || excedeEdicion}
            >
              {editando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form id="form-editar-abono" className="saldo-modal-form" onSubmit={confirmarEdicion}>
          <div className="saldo-modal-resumen">
            <div>
              <span className="saldo-modal-resumen-label">Fecha del abono</span>
              <span className="saldo-modal-resumen-valor">{formatDate(edicion?.abono.fecha)}</span>
            </div>
            <div>
              <span className="saldo-modal-resumen-label">Monto actual</span>
              <span className="saldo-modal-resumen-valor">{formatCurrency(edicion?.abono.monto)}</span>
            </div>
            <div>
              <span className="saldo-modal-resumen-label">Máximo permitido</span>
              <span className="saldo-modal-resumen-valor">{formatCurrency(maximoEdicion)}</span>
            </div>
          </div>

          <p className="saldo-modal-texto">Al guardar, el saldo del plan se recalcula con el nuevo monto.</p>

          <div className="saldo-form-campo">
            <label htmlFor="monto-editar">Nuevo monto</label>
            <InputMonto
              id="monto-editar"
              value={montoEdicion}
              onChange={setMontoEdicion}
              disabled={editando}
            />
          </div>

          {excedeEdicion && (
            <p className="saldo-aviso">El monto no puede ser mayor a {formatCurrency(maximoEdicion)}.</p>
          )}

          <div className="saldo-form-campo">
            <label htmlFor="password-editar">Tu contraseña (para confirmar)</label>
            <input
              id="password-editar"
              type="password"
              autoComplete="current-password"
              value={passwordEdicion}
              onChange={(evento) => setPasswordEdicion(evento.target.value)}
              required
            />
          </div>

          {errorEdicion && <Alert type="error">{errorEdicion}</Alert>}
        </form>
      </Modal>

      <Modal
        open={Boolean(abonoAEliminar)}
        onClose={cerrarEliminacion}
        title="Eliminar abono"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={cerrarEliminacion} disabled={eliminando}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-eliminar-abono"
              className="btn btn-danger btn-md"
              disabled={eliminando || passwordEliminar === ''}
            >
              {eliminando ? 'Eliminando…' : 'Sí, eliminar abono'}
            </button>
          </>
        }
      >
        <form id="form-eliminar-abono" className="saldo-modal-form" onSubmit={confirmarEliminacion}>
          <div className="saldo-modal-resumen peligro">
            <div>
              <span className="saldo-modal-resumen-label">Fecha del abono</span>
              <span className="saldo-modal-resumen-valor">{formatDate(abonoAEliminar?.fecha)}</span>
            </div>
            <div>
              <span className="saldo-modal-resumen-label">Monto</span>
              <span className="saldo-modal-resumen-valor">{formatCurrency(abonoAEliminar?.monto)}</span>
            </div>
          </div>

          <p className="saldo-modal-texto">
            El abono dejará de contar para el saldo del plan. Si se registró en el plan equivocado, después
            regístralo en el plan correcto.
          </p>

          <div className="saldo-form-campo">
            <label htmlFor="motivo-eliminar">Motivo (opcional)</label>
            <input
              id="motivo-eliminar"
              type="text"
              maxLength={300}
              placeholder="Por ejemplo: se registró en otro plan"
              value={motivoEliminar}
              onChange={(evento) => setMotivoEliminar(evento.target.value)}
            />
          </div>

          <div className="saldo-form-campo">
            <label htmlFor="password-eliminar">Tu contraseña (para confirmar)</label>
            <input
              id="password-eliminar"
              type="password"
              autoComplete="current-password"
              value={passwordEliminar}
              onChange={(evento) => setPasswordEliminar(evento.target.value)}
              required
            />
          </div>

          {errorEliminar && <Alert type="error">{errorEliminar}</Alert>}
        </form>
      </Modal>
    </div>
  );
};

export default SaldoAbonosTab;
