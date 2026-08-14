export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
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
