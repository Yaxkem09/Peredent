import { HORA_FIN, HORA_INICIO, formatearHora12, minutosAHora } from './agenda.utils';

// Horarios de la clínica cada 30 min, de 7:00 AM a 7:00 PM, en "HH:mm" (24 h,
// como los guarda el backend) para el value. Cada 30 y no cada 15 para que la
// lista no sea tan larga: el ajuste fino de 15 min se hace arrastrando la
// cita en la agenda.
const PASO_MINUTOS = 30;
const HORARIOS = Array.from(
  { length: ((HORA_FIN - HORA_INICIO) * 60) / PASO_MINUTOS + 1 },
  (_, i) => minutosAHora(HORA_INICIO * 60 + i * PASO_MINUTOS),
);

// Reemplaza al <input type="time">, que el navegador muestra en 24 h según
// la configuración regional: aquí las opciones siempre se leen en AM/PM.
// Si la cita tiene una hora fuera de la lista (p. ej. 10:10 de una cita
// vieja, o 10:15 ajustada arrastrando) se agrega para no perderla.
const SelectorHora = ({ id, value, onChange, disabled }) => {
  const opciones = value && !HORARIOS.includes(value) ? [...HORARIOS, value].sort() : HORARIOS;

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {!value && <option value="">Selecciona</option>}
      {opciones.map((hora) => (
        <option key={hora} value={hora}>
          {formatearHora12(hora)}
        </option>
      ))}
    </select>
  );
};

export default SelectorHora;
