import api from './api';

// SCRUM-265: datos del dashboard que no salen de otros servicios.
export const dashboardService = {
  // SCRUM-270 / SCRUM-271 / SCRUM-272: pagos recibidos hoy y en la semana,
  // con el desglose por método de pago y por día. "semana" es cualquier fecha
  // (yyyy-MM-dd) de la semana a consultar; sin ella, la semana actual.
  // Solo rol Odontologo.
  getResumenPagos: async (semana) => {
    const { data } = await api.get('/dashboard/resumen-pagos', { params: semana ? { semana } : undefined });
    return data;
  },

  // Pacientes con saldo pendiente, de mayor a menor: el top 10 o, con
  // todos=true, la lista completa. Trae también cuántos pacientes deben y el
  // total por cobrar. Solo rol Odontologo.
  getSaldosPendientes: async (todos = false) => {
    const { data } = await api.get('/dashboard/saldos-pendientes', { params: todos ? { todos: true } : undefined });
    return data;
  },
};
