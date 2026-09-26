export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Horario de atención de la clínica, usado para acotar la grilla de horas y
// calcular la posición/tamaño de cada cita dentro de ella.
export const HORA_INICIO = 7;
export const HORA_FIN = 19;

// Alto en px de una hora en la grilla de las vistas día/semana; controla tanto
// las etiquetas del eje como la posición y el alto de cada bloque de cita.
export const ALTURA_HORA_PX = 96;
export const PX_POR_MINUTO = ALTURA_HORA_PX / 60;

// Igual que CitaConstantes.IncrementoMinutos en el backend: la agenda trabaja
// en bloques de 15 min (arrastre, duración mínima y horas de inicio/fin).
export const INCREMENTO_MINUTOS = 15;

// Minutos desde medianoche <-> "HH:mm". Se usan en el arrastre y en los
// formularios de inicio/fin, donde es más cómodo sumar/restar enteros.
export const horaAMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

export const minutosAHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

export const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// yyyy-MM-dd en hora local, sin pasar por UTC (evita el corrimiento de día que
// da Date#toISOString en zonas horarias distintas a la de Guatemala).
export const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseIsoDate = (iso) => new Date(`${iso}T00:00:00`);

export const addDays = (date, n) => {
  const copia = new Date(date);
  copia.setDate(copia.getDate() + n);
  return copia;
};

export const addMonths = (date, n) => {
  const dia = date.getDate();
  const copia = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const ultimoDiaDelMes = new Date(copia.getFullYear(), copia.getMonth() + 1, 0).getDate();
  copia.setDate(Math.min(dia, ultimoDiaDelMes));
  return copia;
};

// Lunes de la semana que contiene `date` (semana lunes→domingo).
export const mondayOf = (date) => {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
};

export const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const formatearFechaLarga = (date) =>
  `${DIAS_SEMANA_LARGO[date.getDay()]} ${date.getDate()} de ${MESES_LARGO[date.getMonth()]}`;

export const formatearFechaCorta = (date) => `${date.getDate()} ${MESES_LARGO[date.getMonth()].slice(0, 3)}`;

// El backend serializa TimeOnly como "HH:mm:ss" (a veces con fracción); solo
// nos interesan horas y minutos para ordenar citas y calcular huecos libres.
export const minutosDesdeInicio = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return (h - HORA_INICIO) * 60 + m;
};

export const ordenarPorHora = (citas) =>
  [...citas].sort((a, b) => minutosDesdeInicio(a.hora) - minutosDesdeInicio(b.hora));

// Suma minutos a una hora "HH:mm[:ss]" y devuelve "HH:mm" (usado para mostrar
// la hora de fin de una cita a partir de su hora de inicio + duración).
export const sumarMinutos = (hora, minutos) => {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// "09:00 a 09:30" -- rango completo de una cita, para mostrar cuánto va a durar.
export const formatearRangoHora = (hora, duracionMinutos) =>
  `${hora.slice(0, 5)} a ${sumarMinutos(hora, duracionMinutos)}`;

// Posición (top) y alto de una cita dentro de la grilla de horas de las
// vistas día/semana, en px, según su hora de inicio y duración.
export const posicionEnGrid = (hora, duracionMinutos) => ({
  top: minutosDesdeInicio(hora) * PX_POR_MINUTO,
  height: duracionMinutos * PX_POR_MINUTO,
});

// Horas enteras del eje lateral de las vistas día/semana (7, 8, 9, ... 19).
export const horasDelDia = () =>
  Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

// Compara la fecha/hora de una cita (strings "yyyy-MM-dd" y "HH:mm[:ss]") contra
// el reloj local del navegador. Solo es una ayuda de UX (deshabilitar campos,
// mostrar avisos): el backend es la autoridad real y decide con hora de
// Guatemala, así que puede haber un pequeño desfase si el navegador está en
// otra zona horaria -- no pasa nada, el backend rechaza igual si hace falta.
export const esCitaPasada = (fecha, hora) => new Date(`${fecha}T${hora}`) < new Date();

// Igual que EstaDentroDelHorario en CitaService.cs (7:00-19:00), pero solo
// para avisar en el front -- el backend sigue siendo el que bloquea de verdad.
export const estaFueraDeHorarioClinica = (hora, duracionMinutos) => {
  const [h, m] = hora.split(':').map(Number);
  const inicioMinutos = h * 60 + m;
  const finMinutos = inicioMinutos + duracionMinutos;
  return inicioMinutos < HORA_INICIO * 60 || finMinutos > HORA_FIN * 60;
};

// Estado (string) que devuelve CitaDto -> modificador de clase CSS para el bloque de cita.
// "Confirmada" usa el estilo base (teal), por eso mapea a cadena vacía.
const CLASES_POR_ESTADO = {
  Pendiente: 'pending',
  Confirmada: '',
  Atendida: 'atendida',
  Cancelada: 'cancelada',
  'No Asistio': 'no-asistio',
};

export const claseDeEstado = (estado) => CLASES_POR_ESTADO[estado] ?? '';

// Solo se pueden arrastrar citas vigentes: ni las ya cerradas (canceladas,
// atendidas, no asistió) ni las de días pasados, que el backend trata como
// historial y no deja reprogramar.
const ESTADOS_NO_REPROGRAMABLES = ['Cancelada', 'Atendida', 'No Asistio'];

export const esCitaReprogramable = (cita) =>
  !ESTADOS_NO_REPROGRAMABLES.includes(cita.estado) && cita.fecha >= toIsoDate(hoy());

// ¿El intervalo [inicio, fin) (minutos desde medianoche) de `fecha` se cruza
// con otra cita del mismo día? Mismo criterio que HayConflictoHorarioAsync:
// las canceladas no ocupan horario.
export const hayTraslape = (citas, { idCita, fecha, inicio, fin }) =>
  citas.some((otra) => {
    if (otra.idCita === idCita || otra.fecha !== fecha || otra.estado === 'Cancelada') return false;
    const otraInicio = horaAMinutos(otra.hora);
    const otraFin = otraInicio + otra.duracionMinutos;
    return otraInicio < fin && inicio < otraFin;
  });
