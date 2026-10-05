import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { abonosService } from '../../services/abonos.service';
import { Alert, EmptyState, Loader, Modal } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import './SaldoAbonos.css';

// SCRUM-63: pestaña "Saldo y abonos" del expediente. Muestra el estado de cuenta
// del paciente (SCRUM-66): un resumen general, el plan activo —donde se registran
// los abonos (SCRUM-64)— y los planes ya cerrados como historial de solo lectura.
// El saldo NO se calcula aquí: se pide al backend para que la fórmula viva en un
// solo lugar (SCRUM-65).
// Los abonos mal registrados no se borran: un admin los anula con su contraseña y
// quedan tachados en el historial, sin contar para el saldo.
// DEUDA TÉCNICA: no hay límite de intentos de contraseña al anular (el backend sí
// tiene un tope de abonos anulados por plan); pendiente definir con el PO.

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

const ListaAbonos = ({ abonos, vacio, puedeAnular, onAnular }) => {
  // Los anulados siguen en el historial pero arrancan ocultos, para que la tabla no
  // se llene de filas tachadas: se muestran con el interruptor.
  const [mostrarAnulados, setMostrarAnulados] = useState(false);

  const anulados = abonos.filter((abono) => abono.anulado);
  const vigentes = abonos.filter((abono) => !abono.anulado);
  const visibles = mostrarAnulados ? abonos : vigentes;

  return (
    <div className="saldo-lista">
      <div className="saldo-lista-head">
        <h4 className="saldo-lista-titulo">Abonos registrados</h4>
        {anulados.length > 0 && (
          <button
            type="button"
            className="saldo-ver-anulados"
            onClick={() => setMostrarAnulados((valor) => !valor)}
          >
            {mostrarAnulados ? 'Ocultar anulados' : `Ver anulados (${anulados.length})`}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="saldo-vacio">
          {anulados.length > 0 ? 'Todos los abonos de este plan están anulados.' : vacio}
        </p>
      ) : (
        <table className="saldo-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Saldo pendiente</th>
              {puedeAnular && <th className="saldo-th-acciones">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((abono) => (
              <tr key={abono.idAbonoPaciente} className={abono.anulado ? 'saldo-fila-anulada' : undefined}>
                <td>
                  {formatDate(abono.fecha)}
                  {abono.anulado && (
                    <span className="saldo-etiqueta-anulado">Anulado {formatDate(abono.fechaAnulacion)}</span>
                  )}
                  {abono.anulado && (abono.motivoAnulacion || abono.usuarioAnulacion) && (
                    <span className="saldo-anulado-detalle">
                      {abono.motivoAnulacion && `Motivo: ${abono.motivoAnulacion}`}
                      {abono.motivoAnulacion && abono.usuarioAnulacion && ' · '}
                      {abono.usuarioAnulacion && `Anulado por ${abono.usuarioAnulacion}`}
                    </span>
                  )}
                </td>
                <td className="saldo-monto">{formatCurrency(abono.monto)}</td>
                <td className="saldo-saldo">{abono.anulado ? '—' : formatearSaldo(abono.saldoPendiente)}</td>
                {puedeAnular && (
                  <td className="saldo-acciones">
                    {!abono.anulado && (
                      <button
                        type="button"
                        className="saldo-anular"
                        onClick={() => onAnular(abono)}
                        title={`Anular el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                        aria-label={`Anular el abono de ${formatCurrency(abono.monto)} del ${formatDate(abono.fecha)}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8.5" />
                          <path d="M6.6 17.4 17.4 6.6" />
                        </svg>
                        Anular
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const TotalesPlan = ({ plan }) => (
  <div className="saldo-totales">
    <span className="saldo-total-item">
      <span className="saldo-total-label">Total</span>
      {formatCurrency(plan.total)}
    </span>

    {plan.descuento > 0 && (
      <span className="saldo-total-item">
        <span className="saldo-total-label">Descuento</span>
        - {formatCurrency(plan.descuento)}
      </span>
    )}

    <span className="saldo-total-item">
      <span className="saldo-total-label">Abonado</span>
      {formatCurrency(plan.abonado)}
    </span>

    <span className="saldo-total-item destacado">
      <span className="saldo-total-label">Saldo pendiente</span>
      {formatearSaldo(plan.saldo)}
    </span>
  </div>
);

const SaldoAbonosTab = ({ idPaciente }) => {
  const { notify } = useNotification();
  const { user } = useAuth();
  // Solo el admin puede anular (misma bandera que usa el menú lateral).
  const esAdmin = Boolean(user?.esAdmin);

  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Anulación: abono elegido + confirmación con la contraseña del admin logueado.
  const [abonoAAnular, setAbonoAAnular] = useState(null);
  const [passwordAnulacion, setPasswordAnulacion] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [errorAnulacion, setErrorAnulacion] = useState(null);
  const [anulando, setAnulando] = useState(false);

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

  const registrar = async (evento) => {
    evento.preventDefault();

    const planActivo = estado?.planes.find((plan) => plan.activo);
    if (planActivo && Number(monto) > planActivo.saldo) {
      notify(avisoSaldoInsuficiente(planActivo.saldo));
      return;
    }

    setGuardando(true);
    try {
      await abonosService.registrar(idPaciente, Number(monto));
      // El saldo se vuelve a pedir para mostrar el recálculo del backend en vez
      // de calcularlo en el cliente.
      setEstado(await abonosService.getEstadoCuentaPaciente(idPaciente));
      setMonto('');
      notify('Abono registrado exitosamente.');
    } catch (err) {
      notify(mensajeError(err, 'No se pudo registrar el abono. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!estado) return null;

  const abrirAnulacion = (abono) => {
    setAbonoAAnular(abono);
    setPasswordAnulacion('');
    setMotivoAnulacion('');
    setErrorAnulacion(null);
  };

  const cerrarAnulacion = () => {
    setAbonoAAnular(null);
    setPasswordAnulacion('');
    setMotivoAnulacion('');
    setErrorAnulacion(null);
  };

  const confirmarAnulacion = async (evento) => {
    evento.preventDefault();
    if (!abonoAAnular) return;

    setAnulando(true);
    setErrorAnulacion(null);
    try {
      await abonosService.anular(idPaciente, abonoAAnular.idAbonoPaciente, passwordAnulacion, motivoAnulacion);
      // Resumen, lista y saldo se refrescan con lo que calculó el backend.
      setEstado(await abonosService.getEstadoCuentaPaciente(idPaciente));
      cerrarAnulacion();
      notify('Abono anulado: dejó de contar en el saldo y quedó tachado en el historial.');
    } catch (err) {
      // El mensaje del backend se muestra dentro del modal, sin cerrarlo.
      setErrorAnulacion(mensajeError(err, 'No se pudo anular el abono. Intenta de nuevo.'));
    } finally {
      setAnulando(false);
    }
  };

  if (!estado.tienePlanes) {
    return (
      <EmptyState
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M3 10h18M15.5 14.5h2.5" />
          </svg>
        }
        title="El paciente todavía no tiene plan de tratamiento"
        description="El saldo se calcula contra el total del plan de tratamiento. En cuanto se registre uno desde la pestaña Plan de tratamiento, vas a poder registrar abonos acá."
      />
    );
  }

  const planActivo = estado.planes.find((plan) => plan.activo) ?? null;
  const excedeSaldo = Boolean(planActivo) && monto !== '' && Number(monto) > planActivo.saldo;
  const saldoAFavor = estado.resumen.saldoPendiente < 0;

  return (
    <div className="saldo">
      <div className="saldo-resumen">
        <div className="saldo-resumen-item">
          <span className="saldo-resumen-label">Total en tratamientos</span>
          <span className="saldo-resumen-valor">{formatCurrency(estado.resumen.totalTratamientos)}</span>
        </div>

        <div className="saldo-resumen-item">
          <span className="saldo-resumen-label">Abonado</span>
          <span className="saldo-resumen-valor">{formatCurrency(estado.resumen.totalAbonado)}</span>
        </div>

        <div className="saldo-resumen-item destacado">
          <span className="saldo-resumen-label">{saldoAFavor ? 'Saldo a favor' : 'Saldo pendiente'}</span>
          <span className="saldo-resumen-valor">{formatCurrency(Math.abs(estado.resumen.saldoPendiente))}</span>
        </div>

        <div className="saldo-resumen-item">
          <span className="saldo-resumen-label">Planes de tratamiento</span>
          <span className="saldo-resumen-valor">{estado.resumen.totalPlanes}</span>
        </div>
      </div>

      {!planActivo && (
        <Alert type="info">
          Este paciente no tiene un plan de tratamiento activo, así que no se pueden registrar abonos. Los planes
          anteriores se muestran solo como historial.
        </Alert>
      )}

      {estado.planes.map((plan) => (
        <section className="saldo-plan" key={plan.idPresupuestoPlan}>
          <div className="saldo-plan-head">
            <h3 className="saldo-plan-titulo">
              {plan.activo ? 'Plan de tratamiento activo' : 'Plan cerrado'}
              <span className="saldo-plan-fecha">
                {plan.activo
                  ? ` · desde ${formatDate(plan.fechaInicio)}`
                  : ` · ${formatDate(plan.fechaInicio)} — ${formatDate(plan.fechaCierre)}`}
              </span>
            </h3>
            {!plan.activo && <span className="saldo-plan-badge">Solo lectura</span>}
          </div>

          <TotalesPlan plan={plan} />

          {plan.activo ? (
            <>
              <form className="saldo-form" onSubmit={registrar}>
                <div className="saldo-form-campo">
                  <label htmlFor="monto-abono">Monto del abono</label>
                  <input
                    id="monto-abono"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={monto}
                    onChange={(evento) => setMonto(evento.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                  disabled={guardando || monto === '' || excedeSaldo}
                >
                  {guardando ? 'Registrando…' : 'Registrar abono'}
                </button>
              </form>
              {excedeSaldo && <p className="saldo-aviso">{avisoSaldoInsuficiente(planActivo.saldo)}</p>}
            </>
          ) : (
            <p className="saldo-nota">
              Este plan ya se cerró: su historial queda como consulta y no se pueden registrar abonos sobre él.
            </p>
          )}

          <ListaAbonos
            abonos={plan.abonos}
            vacio="Todavía no hay abonos registrados en este plan."
            puedeAnular={esAdmin && plan.activo}
            onAnular={abrirAnulacion}
          />
        </section>
      ))}

      <Modal
        open={Boolean(abonoAAnular)}
        onClose={cerrarAnulacion}
        title="Anular abono"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={cerrarAnulacion} disabled={anulando}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-anular-abono"
              className="btn btn-primary btn-md"
              disabled={anulando || passwordAnulacion === ''}
            >
              {anulando ? 'Anulando…' : 'Anular abono'}
            </button>
          </>
        }
      >
        <form id="form-anular-abono" className="saldo-modal-form" onSubmit={confirmarAnulacion}>
          <p className="saldo-modal-texto">
            ¿Anular el abono de {formatCurrency(abonoAAnular?.monto)} del {formatDate(abonoAAnular?.fecha)}? Dejará de
            contar en el saldo y quedará tachado en el historial.
          </p>

          <div className="saldo-form-campo">
            <label htmlFor="password-anular">Tu contraseña</label>
            <input
              id="password-anular"
              type="password"
              autoComplete="current-password"
              value={passwordAnulacion}
              onChange={(evento) => setPasswordAnulacion(evento.target.value)}
              required
            />
          </div>

          <div className="saldo-form-campo">
            <label htmlFor="motivo-anular">Motivo (opcional)</label>
            <input
              id="motivo-anular"
              type="text"
              maxLength={300}
              placeholder="Por qué se anula"
              value={motivoAnulacion}
              onChange={(evento) => setMotivoAnulacion(evento.target.value)}
            />
          </div>

          {errorAnulacion && <Alert type="error">{errorAnulacion}</Alert>}
        </form>
      </Modal>
    </div>
  );
};

export default SaldoAbonosTab;
