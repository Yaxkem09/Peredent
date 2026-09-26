import { useEffect, useRef } from 'react';
import { useNotification } from '../../hooks/useNotification';
import {
  ALTURA_HORA_PX,
  claseDeEstado,
  esCitaReprogramable,
  formatearRangoHora,
  horasDelDia,
  ordenarPorHora,
  posicionEnGrid,
  toIsoDate,
} from './agenda.utils';
import { aplicarVistaPrevia, useArrastreCita } from './useArrastreCita';

const HORAS_EJE = horasDelDia();
const ALTURA_TOTAL = (HORAS_EJE.length - 1) * ALTURA_HORA_PX;
// La nota va en la misma línea que el nombre del paciente, así que una cita
// de 30 min (48 px) ya alcanza para mostrar todo sin estirar el bloque.
const ALTURA_MIN_BLOQUE = 48;
// Por debajo de esto (citas de 15 min) el bloque se pinta a su alto real en
// una sola línea: estirarlo taparía la cita siguiente y su borde de arrastre.
const DURACION_BLOQUE_COMPACTO = 30;

const VistaDia = ({ fechaActual, citas, bloqueos, onSeleccionarCita, onMoverCita, idCitaResaltada }) => {
  const { notify } = useNotification();
  const { vistaPrevia, iniciarArrastre, debeIgnorarClick } = useArrastreCita({
    citas,
    onSoltar: onMoverCita,
    onRechazado: notify,
  });

  const fechaIso = toIsoDate(fechaActual);
  const citasDelDia = ordenarPorHora(aplicarVistaPrevia(citas, vistaPrevia).filter((c) => c.fecha === fechaIso));
  const bloqueo = bloqueos.find((b) => b.fecha === fechaIso);

  // Al llegar desde el expediente con una cita resaltada, se desplaza la
  // página hasta ella una sola vez (no en cada refresco de 5s).
  const yaDesplazadoRef = useRef(false);
  const citaResaltadaVisible = citasDelDia.some((c) => c.idCita === idCitaResaltada);
  useEffect(() => {
    if (!citaResaltadaVisible || yaDesplazadoRef.current) return;
    yaDesplazadoRef.current = true;
    document
      .querySelector(`[data-id-cita="${idCitaResaltada}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [citaResaltadaVisible, idCitaResaltada]);

  return (
    <div className="day-agenda">
      <div className="agenda-count">
        <b>{citasDelDia.length}</b> {citasDelDia.length === 1 ? 'cita programada' : 'citas programadas'}
      </div>

      {bloqueo && (
        <div className="dia-bloqueado-aviso">
          {bloqueo.nombreOdontologo} no labora este día{bloqueo.motivo ? `: ${bloqueo.motivo}` : '.'}
        </div>
      )}

      <div className="grid-scroll">
        <div className="time-grid">
          <div className="hour-axis">
            {HORAS_EJE.map((h, i) => (
              <div className="hour-label" key={h} style={{ top: i * ALTURA_HORA_PX }}>
                {h}:00
              </div>
            ))}
          </div>

          <div className={`canvas-row ${bloqueo ? 'bloqueado' : ''}`.trim()} style={{ height: ALTURA_TOTAL }}>
            {HORAS_EJE.map((h, i) => (
              <div className="hour-line" key={h} style={{ top: i * ALTURA_HORA_PX }} />
            ))}

            {citasDelDia.length === 0 && (
              <div className="canvas-empty">Sin citas programadas para este día.</div>
            )}

            {citasDelDia.map((cita) => {
              const { top, height } = posicionEnGrid(cita.hora, cita.duracionMinutos);
              const compacta = cita.duracionMinutos < DURACION_BLOQUE_COMPACTO;
              const alturaMinima = compacta ? 0 : ALTURA_MIN_BLOQUE;
              const reprogramable = esCitaReprogramable(cita.original);
              const clases = [
                'cita-block',
                claseDeEstado(cita.estado),
                compacta && 'compacta',
                reprogramable && 'arrastrable',
                cita.enArrastre && 'en-arrastre',
                cita.motivoInvalido && 'invalida',
                cita.idCita === idCitaResaltada && 'resaltada',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={cita.idCita}
                  data-id-cita={cita.idCita}
                  className={clases}
                  style={{ top, height: cita.enArrastre ? height : Math.max(height, alturaMinima) }}
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

                  {!compacta && (
                    <div className="cb-top">
                      <span className="cb-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                      <span className="cb-dot" />
                    </div>
                  )}
                  <div className="cb-linea">
                    {compacta && (
                      <span className="cb-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                    )}
                    <span className="cb-nombre">{cita.nombrePaciente}</span>
                    {cita.motivoInvalido ? (
                      <span className="cb-aviso">{cita.motivoInvalido}</span>
                    ) : (
                      cita.notasAdicionales && (
                        <span className="cb-nota" title={cita.notasAdicionales}>
                          <span className="cb-nota-label">Nota</span>
                          {cita.notasAdicionales}
                        </span>
                      )
                    )}
                  </div>

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
        </div>
      </div>
    </div>
  );
};

export default VistaDia;
