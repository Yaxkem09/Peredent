import { claseDeEstado, formatearHueco, minutosDesdeInicio, ordenarPorHora, toIsoDate } from './agenda.utils';

// Arma la lista intercalando huecos libres cuando entre el fin de una cita y
// el inicio de la siguiente hay más tiempo libre que la duración normal de
// una cita (evita marcar huecos por los minutos "de cortesía" entre citas).
const armarFilas = (citasDelDia) => {
  const filas = [];
  let finAnterior = null;

  citasDelDia.forEach((cita) => {
    const inicio = minutosDesdeInicio(cita.hora);
    if (finAnterior !== null) {
      const brecha = inicio - finAnterior;
      if (brecha > cita.duracionMinutos) {
        filas.push({ tipo: 'hueco', key: `hueco-${cita.idCita}`, minutos: brecha });
      }
    }
    filas.push({ tipo: 'cita', key: cita.idCita, cita });
    finAnterior = inicio + cita.duracionMinutos;
  });

  return filas;
};

const VistaDia = ({ fechaActual, citas, onSeleccionarCita }) => {
  const fechaIso = toIsoDate(fechaActual);
  const citasDelDia = ordenarPorHora(citas.filter((c) => c.fecha === fechaIso));
  const filas = armarFilas(citasDelDia);

  return (
    <div className="day-agenda">
      <div className="agenda-count">
        <b>{citasDelDia.length}</b> {citasDelDia.length === 1 ? 'cita programada' : 'citas programadas'}
      </div>

      {citasDelDia.length === 0 ? (
        <div className="agenda-empty">Sin citas programadas para este día.</div>
      ) : (
        <div className="agenda-list">
          {filas.map((fila) =>
            fila.tipo === 'hueco' ? (
              <div className="agenda-hueco" key={fila.key}>
                {formatearHueco(fila.minutos)}
              </div>
            ) : (
              <div
                key={fila.key}
                className={`cita-row ${claseDeEstado(fila.cita.estado)}`.trim()}
                onClick={() => onSeleccionarCita(fila.cita)}
              >
                <div className="cr-hora">
                  <div className="h">{fila.cita.hora.slice(0, 5)}</div>
                  <div className="d">{fila.cita.duracionMinutos} min</div>
                </div>
                <div className="cr-sep" />
                <div className="cr-info">
                  <div className="cr-nombre">{fila.cita.nombrePaciente}</div>
                  <div className="cr-servicio">{fila.cita.tipoTratamiento}</div>
                </div>
                <div className={`cr-estado ${claseDeEstado(fila.cita.estado)}`.trim()}>{fila.cita.estado}</div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
};

export default VistaDia;
