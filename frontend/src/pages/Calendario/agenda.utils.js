export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Horario de atención de la clínica, usado para calcular huecos libres entre citas.
export const HORA_INICIO = 7;
export const HORA_FIN = 19;

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

// Texto legible para el hueco libre entre el fin de una cita y el inicio de la
// siguiente en la vista día (ej. "1 h 30 min libres").
export const formatearHueco = (minutos) => {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  const partes = [];
  if (horas > 0) partes.push(`${horas} h`);
  if (mins > 0) partes.push(`${mins} min`);
  return `${partes.join(' ')} libres`;
};

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
