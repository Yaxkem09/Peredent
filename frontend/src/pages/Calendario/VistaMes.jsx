import { useEffect, useState } from 'react';
import {
  DIAS_SEMANA_CORTO,
  DIAS_SEMANA_LARGO,
  MESES_LARGO,
  addDays,
  mondayOf,
  toIsoDate,
  hoy,
  claseDeEstado,
  ordenarPorHora,
  formatearRangoHora,
} from './agenda.utils';

// Viñetas visibles por celda; el resto se resume en "+N más" (el detalle
// completo del día sigue estando en el panel lateral). Con 6 semanas las
// filas quedan más bajas, así que caben menos.
const MAX_VINETAS_POR_DIA = { 4: 5, 5: 4, 6: 3 };

const VistaMes = ({
  fechaActual,
  citas,
  bloqueos,
  esOdontologo,
  onSeleccionarCita,
  onVerMas,
  onMarcarBloqueo,
  onQuitarBloqueo,
}) => {
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const hoyIso = toIsoDate(hoy());

  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaActual);

  // Al cambiar de mes, selecciona hoy si cae en el mes visible; si no, el día 1.
  useEffect(() => {
    const ahora = hoy();
    const hoyEnEsteMes = ahora.getFullYear() === anio && ahora.getMonth() === mes;
    setFechaSeleccionada(hoyEnEsteMes ? ahora : new Date(anio, mes, 1));
  }, [anio, mes]);

  const primerDiaMes = new Date(anio, mes, 1);
  const inicioGrid = mondayOf(primerDiaMes);
  // Solo las semanas que el mes realmente ocupa (4 a 6): una fila entera de
  // días del mes siguiente solo alargaba el calendario sin aportar nada.
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const diasAntesDelPrimero = (primerDiaMes.getDay() + 6) % 7;
  const semanas = Math.ceil((diasAntesDelPrimero + diasEnMes) / 7);
  const celdas = Array.from({ length: semanas * 7 }, (_, i) => addDays(inicioGrid, i));

  const citasPorFecha = new Map();
  citas.forEach((cita) => {
    if (!citasPorFecha.has(cita.fecha)) citasPorFecha.set(cita.fecha, []);
    citasPorFecha.get(cita.fecha).push(cita);
  });

  const fechaSeleccionadaIso = toIsoDate(fechaSeleccionada);
  const citasDelDiaSeleccionado = ordenarPorHora(citasPorFecha.get(fechaSeleccionadaIso) || []);
  const bloqueoDelDiaSeleccionado = bloqueos.find((b) => b.fecha === fechaSeleccionadaIso);

  return (
    <div className="month-wrap">
      <div className="month-calendar">
        <div className="month-head-row">
          {DIAS_SEMANA_CORTO.map((nombre) => (
            <div className="month-head-cell" key={nombre}>
              {nombre}
            </div>
          ))}
        </div>

        <div className="month-grid">
          {celdas.map((fechaCelda) => {
            const fechaIso = toIsoDate(fechaCelda);
            const fueraDeMes = fechaCelda.getMonth() !== mes;
            const citasDelDia = ordenarPorHora(citasPorFecha.get(fechaIso) || []);
            const bloqueado = bloqueos.some((b) => b.fecha === fechaIso);
            const vinetas = citasDelDia.slice(0, MAX_VINETAS_POR_DIA[semanas] ?? 3);
            const restantes = citasDelDia.length - vinetas.length;

            return (
              <div
                key={fechaIso}
                className={`month-cell ${fueraDeMes ? 'outside' : ''} ${fechaIso === hoyIso ? 'today' : ''} ${
                  fechaIso === fechaSeleccionadaIso ? 'selected' : ''
                } ${bloqueado ? 'bloqueado' : ''}`.trim()}
                onClick={() => setFechaSeleccionada(fechaCelda)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setFechaSeleccionada(fechaCelda);
                }}
              >
                <div className="month-daynum">{fechaCelda.getDate()}</div>

                {bloqueado && <div className="month-cell-bloqueado">No labora</div>}

                {vinetas.map((cita) => (
                  <button
                    type="button"
                    key={cita.idCita}
                    className={`mc-chip ${claseDeEstado(cita.estado)}`.trim()}
                    title={`${formatearRangoHora(cita.hora, cita.duracionMinutos)} · ${cita.nombrePaciente}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeleccionarCita(cita);
                    }}
                  >
                    <span className="mc-hora">{cita.hora.slice(0, 5)}</span>
                    <span className="mc-nombre">{cita.nombrePaciente}</span>
                  </button>
                ))}

                {restantes > 0 && <div className="mc-mas">+{restantes} más</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-panel">
        <div className="sp-head">
          <div className="sp-dia-semana">{DIAS_SEMANA_LARGO[fechaSeleccionada.getDay()]}</div>
          <div className="sp-fecha">
            {fechaSeleccionada.getDate()} de {MESES_LARGO[fechaSeleccionada.getMonth()]}
          </div>
          <div className="sp-count">
            <b>{citasDelDiaSeleccionado.length}</b>{' '}
            {citasDelDiaSeleccionado.length === 1 ? 'cita programada' : 'citas programadas'}
          </div>
        </div>

        <div className="sp-body">
          <div className="sp-head-actions">
            <button type="button" className="sp-ver-dia" onClick={() => onVerMas(fechaSeleccionada)}>
              Ver día
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            {esOdontologo && (
              <button
                type="button"
                className={`agenda-bloqueo-btn ${bloqueoDelDiaSeleccionado ? 'quitar' : ''}`.trim()}
                onClick={() =>
                  bloqueoDelDiaSeleccionado
                    ? onQuitarBloqueo(bloqueoDelDiaSeleccionado)
                    : onMarcarBloqueo(fechaSeleccionada)
                }
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" />
                  <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                  {bloqueoDelDiaSeleccionado ? <path d="M9 14.5l2 2 4-4" /> : <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" />}
                </svg>
                {bloqueoDelDiaSeleccionado ? 'Quitar bloqueo' : 'Marcar día no laboral'}
              </button>
            )}
          </div>

          {bloqueoDelDiaSeleccionado && (
            <div className="dia-bloqueado-aviso">
              No labora este día{bloqueoDelDiaSeleccionado.motivo ? `: ${bloqueoDelDiaSeleccionado.motivo}` : '.'}
            </div>
          )}

        {citasDelDiaSeleccionado.length === 0 ? (
          <div className="sp-empty">Sin citas programadas.</div>
        ) : (
          <div className="sp-list">
            {citasDelDiaSeleccionado.map((cita) => (
              <div
                key={cita.idCita}
                className={`sp-card ${claseDeEstado(cita.estado)}`.trim()}
                onClick={() => onSeleccionarCita(cita)}
              >
                <div className="sp-top">
                  <span className="sp-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                  <span className="sp-dot" />
                </div>
                <b>{cita.nombrePaciente}</b>
                {cita.notasAdicionales && (
                  <div className="sp-nota">
                    <span className="cb-nota-label">Nota</span>
                    {cita.notasAdicionales}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default VistaMes;
