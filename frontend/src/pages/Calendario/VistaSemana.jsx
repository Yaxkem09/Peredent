import { useRef } from 'react';
import { useNotification } from '../../hooks/useNotification';
import {
  ALTURA_HORA_PX,
  DIAS_SEMANA_CORTO,
  addDays,
  claseDeEstado,
  esCitaReprogramable,
  formatearRangoHora,
  horasDelDia,
  hoy,
  mondayOf,
  ordenarPorHora,
  posicionEnGrid,
  toIsoDate,
} from './agenda.utils';
import { aplicarVistaPrevia, useArrastreCita } from './useArrastreCita';

const HORAS_EJE = horasDelDia();
const ALTURA_TOTAL = (HORAS_EJE.length - 1) * ALTURA_HORA_PX;
const ALTURA_MIN_BLOQUE = 48;
// Citas de 15 min: se pintan a su alto real (ver VistaDia).
const DURACION_BLOQUE_COMPACTO = 30;

const VistaSemana = ({ fechaActual, citas, bloqueos, onSeleccionarCita, onMoverCita }) => {
  const { notify } = useNotification();
  const lunes = mondayOf(fechaActual);
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const hoyIso = toIsoDate(hoy());
  const columnasRef = useRef(null);

  // Columna (día) que queda bajo el puntero, para poder pasar una cita de un
  // día a otro arrastrándola de lado en la vista semana.
  const fechaEnPunto = (clientX) => {
    const rect = columnasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const indice = Math.min(Math.max(Math.floor(((clientX - rect.left) / rect.width) * 7), 0), 6);
    return toIsoDate(diasDeLaSemana[indice]);
  };

  const esFechaPermitida = (fechaIso) => fechaIso >= hoyIso && !bloqueos.some((b) => b.fecha === fechaIso);

  const { vistaPrevia, iniciarArrastre, debeIgnorarClick } = useArrastreCita({
    citas,
    fechaEnPunto,
    esFechaPermitida,
    onSoltar: onMoverCita,
    onRechazado: notify,
  });

  const citasVisibles = aplicarVistaPrevia(citas, vistaPrevia);

  return (
    <div className="week-agenda">
      <div className="week-head-row">
        <div className="week-head-spacer" />
        {diasDeLaSemana.map((dia, i) => {
          const fechaIso = toIsoDate(dia);
          const bloqueado = bloqueos.some((b) => b.fecha === fechaIso);
          return (
            <div
              className={`week-head-cell ${fechaIso === hoyIso ? 'today' : ''} ${bloqueado ? 'bloqueado' : ''}`.trim()}
              key={fechaIso}
            >
              <div className="wd-name">{DIAS_SEMANA_CORTO[i]}</div>
              <div className="wd-num">{dia.getDate()}</div>
              {bloqueado && <div className="wd-bloqueado">No labora</div>}
            </div>
          );
        })}
      </div>

      <div className="grid-scroll">
        <div className="week-shell">
          <div className="hour-axis">
            {HORAS_EJE.map((h, i) => (
              <div className="hour-label" key={h} style={{ top: i * ALTURA_HORA_PX }}>
                {h}:00
              </div>
            ))}
          </div>

          <div className="week-days" ref={columnasRef}>
            {diasDeLaSemana.map((dia) => {
              const fechaIso = toIsoDate(dia);
              const citasDelDia = ordenarPorHora(citasVisibles.filter((c) => c.fecha === fechaIso));
              const bloqueado = bloqueos.some((b) => b.fecha === fechaIso);

              return (
                <div
                  className={`week-col ${fechaIso === hoyIso ? 'today' : ''} ${bloqueado ? 'bloqueado' : ''}`.trim()}
                  style={{ height: ALTURA_TOTAL }}
                  key={fechaIso}
                >
                  {HORAS_EJE.map((h, i) => (
                    <div className="hour-line" key={h} style={{ top: i * ALTURA_HORA_PX }} />
                  ))}

                  {citasDelDia.map((cita) => {
                    const { top, height } = posicionEnGrid(cita.hora, cita.duracionMinutos);
                    const compacta = cita.duracionMinutos < DURACION_BLOQUE_COMPACTO;
                    const reprogramable = esCitaReprogramable(cita.original);
                    const clases = [
                      'wk-block',
                      claseDeEstado(cita.estado),
                      compacta && 'compacta',
                      reprogramable && 'arrastrable',
                      cita.enArrastre && 'en-arrastre',
                      cita.motivoInvalido && 'invalida',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div
                        key={cita.idCita}
                        className={clases}
                        style={{
                          top,
                          height: compacta || cita.enArrastre ? height : Math.max(height, ALTURA_MIN_BLOQUE),
                        }}
                        title={cita.motivoInvalido ?? cita.notasAdicionales ?? undefined}
                        onPointerDown={reprogramable ? (e) => iniciarArrastre(e, cita.original, 'mover') : undefined}
                        onClick={() => {
                          if (!debeIgnorarClick()) onSeleccionarCita(cita.original);
                        }}
                      >
                        {reprogramable && (
                          <div
                            className="cita-resize arriba"
                            onPointerDown={(e) => iniciarArrastre(e, cita.original, 'arriba')}
                          />
                        )}
                        <span className="wk-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                        <span className="wk-nombre">{cita.nombrePaciente}</span>
                        {!compacta && cita.notasAdicionales && (
                          <span className="wk-nota">{cita.notasAdicionales}</span>
                        )}
                        {reprogramable && (
                          <div
                            className="cita-resize abajo"
                            onPointerDown={(e) => iniciarArrastre(e, cita.original, 'abajo')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VistaSemana;
