export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Horario de atención de la clínica y alto de fila usado para posicionar las citas.
export const HORA_INICIO = 7;
export const HORA_FIN = 19;
export const ALTO_HORA = 60; // px por hora (1px = 1 minuto)

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
// nos interesan horas y minutos para ubicar el bloque en la grilla.
export const minutosDesdeInicio = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return (h - HORA_INICIO) * 60 + m;
};

export const ordenarPorHora = (citas) =>
  [...citas].sort((a, b) => minutosDesdeInicio(a.hora) - minutosDesdeInicio(b.hora));

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
