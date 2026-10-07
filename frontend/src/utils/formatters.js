// Una fecha sin hora ("2026-09-25", p. ej. un DateOnly del backend) es un día de
// calendario, pero new Date() la interpreta como medianoche UTC y en Guatemala
// (UTC-6) se mostraría el día anterior. Se arma como fecha local.
const FECHA_SIN_HORA = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDate = (value) => {
  const soloFecha = typeof value === 'string' && FECHA_SIN_HORA.exec(value);
  if (soloFecha) {
    const [, anio, mes, dia] = soloFecha;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }
  return new Date(value);
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
};

export const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `Q ${amount.toFixed(2)}`;
};
