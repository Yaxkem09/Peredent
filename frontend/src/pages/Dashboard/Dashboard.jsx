import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { pacientesService } from '../../services/pacientes.service';
import { citasService } from '../../services/citas.service';
import { dashboardService } from '../../services/dashboard.service';
import { formatCurrency } from '../../utils/formatters';
import { Loader, EmptyState } from '../../components/common';
import BotonGuia from '../../components/common/BotonGuia';
import { GUIA_DASHBOARD } from '../guiasPantallas';
import { ROUTES } from '../../routes/routes';
import { formatearRangoHora } from '../Calendario/agenda.utils';
import '../../styles/page-header.css';
import './Dashboard.css';

const saludo = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

// yyyy-MM-dd en hora local (sin pasar por UTC, para no correr el día en Guatemala).
const isoLocal = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sumarDias = (fecha, n) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + n);
  return copia;
};

const fechaLargaLocal = (fecha) =>
  fecha.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });

const ESTADO_CLASE = {
  Pendiente: 'is-pendiente',
  Confirmada: 'is-confirmada',
  Atendida: 'is-atendida',
  Cancelada: 'is-cancelada',
  'No Asistio': 'is-no-asistio',
};

// "Por atender": citas que todavía no se resuelven (ni atendidas, ni canceladas, ni no-asistió).
const PENDIENTES = new Set(['Pendiente', 'Confirmada']);

// SCRUM-274: cada cuánto se vuelve a pedir el resumen de pagos mientras el
// dashboard está abierto (además de al volver a la pestaña).
const REFRESCO_PAGOS_MS = 60 * 1000;

const fechaCortaLocal = (iso) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
};

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const ordenarPorHora = (a, b) => (a.hora || '').localeCompare(b.hora || '');

const IconoPacientes = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <circle cx="17" cy="7" r="2.4" />
    <path d="M15 20c0-2.6 1.7-4.5 4-4.9" />
  </svg>
);

const IconoHoy = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

const IconoManana = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M12 12.5V15l1.6 1.6" />
  </svg>
);

const CitaRow = ({ cita }) => (
  <Link
    to={ROUTES.PACIENTE_DETALLE(cita.idPaciente)}
    className={`dash-cita ${ESTADO_CLASE[cita.estado] || ''}`}
    title={`Abrir expediente de ${cita.nombrePaciente || 'paciente'}`}
  >
    <span className="dash-cita-hora">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      {cita.hora ? formatearRangoHora(cita.hora, cita.duracionMinutos) : ''}
    </span>
    <span className="dash-cita-avatar" aria-hidden="true">
      {(cita.nombrePaciente || 'P')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join('')
        .toUpperCase()}
    </span>
    <span className="dash-cita-body">
      <span className="dash-cita-nombre">{cita.nombrePaciente || 'Paciente'}</span>
      {cita.notasAdicionales ? <span className="dash-cita-nota">{cita.notasAdicionales}</span> : null}
    </span>
    <span className={`dash-cita-estado ${ESTADO_CLASE[cita.estado] || ''}`}>{cita.estado}</span>
    <svg
      className="dash-cita-arrow"
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  </Link>
);

const PanelCitas = ({ titulo, citas, error, vacio, tono }) => (
  <section className={`dash-panel tono-${tono}`}>
    <div className="dash-panel-head">
      <h3>{titulo}</h3>
      {!error && <span className="dash-count">{citas.length}</span>}
    </div>
    {error ? (
      <EmptyState title="Agenda no disponible" description="Aún no se pueden cargar las citas desde el servidor." />
    ) : citas.length === 0 ? (
      <EmptyState title={vacio.title} description={vacio.description} />
    ) : (
      <div className="dash-cita-list">
        {citas.map((cita) => (
          <CitaRow key={cita.idCita} cita={cita} />
        ))}
      </div>
    )}
  </section>
);

// SCRUM-270 / SCRUM-271 / SCRUM-272: total del periodo y su desglose por método.
const TarjetaPagos = ({ titulo, subtitulo, periodo, children }) => {
  const total = Number(periodo.total) || 0;
  return (
    <div className="dash-pagos-card">
      <div className="dash-pagos-card-head">
        <span className="dash-pagos-titulo">{titulo}</span>
        <span className="dash-pagos-sub">{subtitulo}</span>
      </div>
      {children}
      <div className="dash-pagos-total">{formatCurrency(total)}</div>
      <div className="dash-pagos-cantidad">
        {periodo.cantidadPagos === 1 ? '1 pago' : `${periodo.cantidadPagos} pagos`}
      </div>
      <ul className="dash-pagos-metodos">
        {periodo.porMetodo.map((m) => {
          const porcentaje = total > 0 ? Math.round((Number(m.total) / total) * 100) : 0;
          return (
            <li key={m.idMetodoPago}>
              <div className="dash-pagos-metodo-fila">
                <span>{m.metodoPago}</span>
                <span className="dash-pagos-metodo-monto">{formatCurrency(m.total)}</span>
              </div>
              <div className="dash-pagos-barra" aria-hidden="true">
                <span style={{ width: `${porcentaje}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// SCRUM-274: los montos se recalculan en el backend en cada consulta; acá se
// vuelven a pedir al montar, cada minuto y al regresar a la pestaña, así un
// abono recién registrado aparece sin recargar la página. "pedir" cambia de
// identidad cuando cambia lo que se consulta (p. ej. la semana).
const useDatosRefrescados = (pedir) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;

    const cargar = () => {
      pedir()
        .then((data) => {
          if (!activo) return;
          setDatos(data);
          setError(false);
        })
        .catch(() => { if (activo) setError(true); });
    };

    const alVolver = () => {
      if (document.visibilityState === 'visible') cargar();
    };

    cargar();
    const intervalo = setInterval(cargar, REFRESCO_PAGOS_MS);
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [pedir]);

  return { datos, error };
};

const isoMasDias = (iso, n) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return isoLocal(new Date(y, m - 1, d + n));
};

const PanelPagos = () => {
  // Fecha (yyyy-MM-dd) de la semana consultada; null = semana actual.
  const [semana, setSemana] = useState(null);
  // Día de la semana que se muestra (yyyy-MM-dd); null = el de por defecto
  // (hoy en la semana actual, el lunes en una semana anterior).
  const [diaElegido, setDiaElegido] = useState(null);

  const pedir = useCallback(() => dashboardService.getResumenPagos(semana), [semana]);
  const { datos: resumen, error } = useDatosRefrescados(pedir);

  // Mientras llega la semana pedida se sigue viendo la anterior (atenuada) y
  // las flechas se deshabilitan.
  const cargandoSemana = Boolean(
    resumen && (semana ? resumen.semana.desde.slice(0, 10) !== semana : !resumen.esSemanaActual),
  );

  const cambiarSemana = (nuevaSemana) => {
    setSemana(nuevaSemana);
    setDiaElegido(null);
  };

  const fechaHoy = resumen?.hoy.desde.slice(0, 10);
  const esSemanaActual = Boolean(resumen?.esSemanaActual);
  const periodoElegido = resumen?.dias.find((d) => d.desde.slice(0, 10) === diaElegido);
  const periodoDia = periodoElegido ?? (esSemanaActual ? resumen?.hoy : resumen?.dias[0]);
  const fechaDia = periodoDia?.desde.slice(0, 10);
  const indiceDia = resumen ? resumen.dias.findIndex((d) => d.desde.slice(0, 10) === fechaDia) : -1;
  const esHoy = fechaDia === fechaHoy;

  return (
    <section className="dash-panel tono-verde dash-pagos">
      <div className="dash-panel-head">
        <h3>Pagos recibidos</h3>
        {resumen && (
          <div className="dash-semanas" role="group" aria-label="Cambiar de semana">
            {!esSemanaActual && (
              <button
                type="button"
                className="dash-semanas-actual"
                onClick={() => cambiarSemana(null)}
                disabled={cargandoSemana}
              >
                Ir a esta semana
              </button>
            )}
            <button
              type="button"
              className="dash-semanas-flecha"
              onClick={() => cambiarSemana(isoMasDias(resumen.semana.desde, -7))}
              aria-label="Semana anterior"
              title="Semana anterior"
              disabled={cargandoSemana}
            >
              ‹
            </button>
            <span className="dash-semanas-rango">
              {fechaCortaLocal(resumen.semana.desde)} – {fechaCortaLocal(resumen.semana.hasta)}
            </span>
            <button
              type="button"
              className="dash-semanas-flecha"
              onClick={() => {
                const siguiente = isoMasDias(resumen.semana.desde, 7);
                cambiarSemana(siguiente > fechaHoy ? null : siguiente);
              }}
              aria-label="Semana siguiente"
              title="Semana siguiente"
              disabled={esSemanaActual || cargandoSemana}
            >
              ›
            </button>
          </div>
        )}
      </div>
      {error && !resumen ? (
        <EmptyState title="Resumen no disponible" description="No se pudo cargar el resumen de pagos." />
      ) : !resumen ? (
        <Loader label="Cargando pagos..." />
      ) : (
        <div className={`dash-pagos-grid${cargandoSemana ? ' cargando' : ''}`}>
          <TarjetaPagos
            titulo={esHoy ? 'Hoy' : NOMBRES_DIAS[indiceDia]}
            subtitulo={fechaCortaLocal(periodoDia.desde)}
            periodo={periodoDia}
          >
            <div className="dash-pagos-dias" role="group" aria-label="Elegir día de la semana">
              {resumen.dias.map((dia, i) => {
                const fecha = dia.desde.slice(0, 10);
                return (
                  <button
                    type="button"
                    key={fecha}
                    className={fecha === fechaDia ? 'active' : ''}
                    aria-pressed={fecha === fechaDia}
                    disabled={fecha > fechaHoy}
                    title={fechaCortaLocal(dia.desde)}
                    onClick={() => setDiaElegido(fecha)}
                  >
                    {DIAS_SEMANA[i]}
                  </button>
                );
              })}
            </div>
          </TarjetaPagos>
          <TarjetaPagos
            titulo={esSemanaActual ? 'Esta semana' : 'Toda la semana'}
            subtitulo={`${fechaCortaLocal(resumen.semana.desde)} – ${fechaCortaLocal(resumen.semana.hasta)}`}
            periodo={resumen.semana}
          />
        </div>
      )}
    </section>
  );
};

const TOP_SALDOS = 10;

// Saldos pendientes por cobrar (solo odontólogo): el top 10 y, a pedido, la
// lista completa. Arriba, cuántos pacientes deben y el total por cobrar.
const PanelSaldos = () => {
  const [verTodos, setVerTodos] = useState(false);
  const pedir = useCallback(() => dashboardService.getSaldosPendientes(verTodos), [verTodos]);
  const { datos: saldos, error } = useDatosRefrescados(pedir);

  const pacientesSaldo = saldos?.pacientes ?? [];
  const hayMas = Boolean(saldos && saldos.totalPacientes > TOP_SALDOS);

  return (
    <section className="dash-panel tono-rojo dash-saldos">
      <div className="dash-panel-head">
        <h3>{verTodos ? 'Saldos pendientes por cobrar' : 'Top 10 · Saldos pendientes por cobrar'}</h3>
        {hayMas && (
          <button type="button" className="dash-saldos-ver" onClick={() => setVerTodos((v) => !v)}>
            {verTodos ? 'Mostrar solo el top 10' : `Ver todos (${saldos.totalPacientes})`}
          </button>
        )}
      </div>
      {error && !saldos ? (
        <EmptyState title="Saldos no disponibles" description="No se pudieron cargar los saldos pendientes." />
      ) : !saldos ? (
        <Loader label="Cargando saldos..." />
      ) : saldos.totalPacientes === 0 ? (
        <EmptyState title="Sin saldos pendientes" description="Ningún paciente tiene saldo por cobrar." />
      ) : (
        <>
          <div className="dash-saldos-resumen">
            <div>
              <span className="dash-saldos-resumen-label">Total por cobrar</span>
              <span className="dash-saldos-resumen-monto">{formatCurrency(saldos.totalPorCobrar)}</span>
            </div>
            <div>
              <span className="dash-saldos-resumen-label">Pacientes con saldo</span>
              <span className="dash-saldos-resumen-num">{saldos.totalPacientes}</span>
            </div>
          </div>
          <ol className={`dash-saldos-lista${verTodos ? ' completa' : ''}`}>
            {pacientesSaldo.map((p, i) => (
              <li key={p.idPaciente}>
                <Link
                  to={`${ROUTES.PACIENTE_DETALLE(p.idPaciente)}?tab=saldo`}
                  className="dash-saldo"
                  title={`Abrir saldo y abonos de ${p.nombrePaciente}`}
                >
                  <span className="dash-saldo-pos">{i + 1}</span>
                  <span className="dash-saldo-body">
                    <span className="dash-saldo-nombre">{p.nombrePaciente}</span>
                    <span className="dash-saldo-detalle">
                      <span className="dash-saldo-tel">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                        </svg>
                        {p.telefono || 'Sin teléfono'}
                      </span>
                      {p.planesConSaldo > 1 && (
                        <span className="dash-saldo-planes">{p.planesConSaldo} planes con saldo</span>
                      )}
                    </span>
                  </span>
                  <span className="dash-saldo-monto">{formatCurrency(p.saldoPendiente)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  // SCRUM-273: el resumen de pagos es solo para el odontólogo.
  const esOdontologo = user?.rol === 'Odontologo';
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState({ pacientes: false, citas: false });

  const { hoy, manana, desde, hasta, etiquetaHoy, etiquetaManana } = useMemo(() => {
    const ahora = new Date();
    const dManana = sumarDias(ahora, 1);
    return {
      hoy: isoLocal(ahora),
      manana: isoLocal(dManana),
      desde: isoLocal(ahora),
      hasta: isoLocal(sumarDias(ahora, 7)),
      etiquetaHoy: fechaLargaLocal(ahora),
      etiquetaManana: fechaLargaLocal(dManana),
    };
  }, []);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      const [rPacientes, rCitas] = await Promise.allSettled([
        pacientesService.getAll(),
        citasService.getAll({ desde, hasta }),
      ]);

      if (!activo) return;

      setPacientes(rPacientes.status === 'fulfilled' ? rPacientes.value : []);
      setCitas(rCitas.status === 'fulfilled' ? rCitas.value : []);
      setErrores({
        pacientes: rPacientes.status === 'rejected',
        citas: rCitas.status === 'rejected',
      });
      setLoading(false);
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  const citasHoy = useMemo(() => citas.filter((c) => c.fecha === hoy), [citas, hoy]);
  const citasManana = useMemo(
    () => citas.filter((c) => c.fecha === manana).sort(ordenarPorHora),
    [citas, manana],
  );
  const porAtenderHoy = useMemo(
    () => citasHoy.filter((c) => PENDIENTES.has(c.estado)).sort(ordenarPorHora),
    [citasHoy],
  );

  if (loading) {
    return <Loader fullscreen label="Cargando panel..." />;
  }

  const dash = errores.citas ? '—' : undefined;
  const stats = [
    { label: 'Pacientes totales', value: errores.pacientes ? '—' : pacientes.length, icon: <IconoPacientes />, tono: 'teal' },
    { label: 'Citas de hoy', value: dash ?? citasHoy.length, icon: <IconoHoy />, tono: 'accent' },
    { label: 'Citas de mañana', value: dash ?? citasManana.length, icon: <IconoManana />, tono: 'amber' },
  ];

  return (
    <div className="dashboard page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel</div>
          <h2>
            {saludo()}
            {user?.usuario ? `, ${user.usuario}` : ''}
          </h2>
          <p>Resumen de la actividad clínica · {etiquetaHoy}</p>
        </div>
        <div className="dash-head-acciones">
          <BotonGuia pasos={GUIA_DASHBOARD} className="btn btn-md btn-head-sec dash-head-btn" />
          <Link to={ROUTES.CALENDARIO} className="btn btn-primary btn-md dash-head-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </svg>
            Ir a la agenda
          </Link>
          <Link to={ROUTES.PACIENTE_NUEVO} className="btn btn-md btn-head-sec dash-head-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo paciente
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card tono-${stat.tono}`}>
            <span className="stat-icon">{stat.icon}</span>
            <div className="stat-body">
              <div className="label">{stat.label}</div>
              <div className="value">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <PanelCitas
          tono="accent"
          titulo="Por atender hoy"
          citas={porAtenderHoy}
          error={errores.citas}
          vacio={{
            title: 'Nada pendiente para hoy',
            description: 'No quedan citas por atender el día de hoy.',
          }}
        />
        <PanelCitas
          tono="amber"
          titulo={`Agenda de mañana · ${etiquetaManana}`}
          citas={citasManana}
          error={errores.citas}
          vacio={{
            title: 'Sin citas para mañana',
            description: 'Todavía no hay citas programadas para mañana.',
          }}
        />
      </div>

      {/* SCRUM-273: los montos de la clínica solo los ve el odontólogo; la
          asistente solo ve las citas. */}
      {esOdontologo && (
        <>
          <PanelPagos />
          <PanelSaldos />
        </>
      )}
    </div>
  );
};

export default Dashboard;
