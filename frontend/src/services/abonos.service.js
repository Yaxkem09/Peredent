import api from './api';

// SCRUM-63: abonos que hace el paciente y su saldo pendiente.
export const abonosService = {
  // Estado de cuenta del plan activo: totales del plan, abonado, saldo e
  // historial de abonos con el saldo que quedó tras cada uno (SCRUM-65 / SCRUM-66).
  getEstadoCuenta: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/abonos`);
    return data;
  },

  // SCRUM-66: estado de cuenta completo del paciente: todos sus planes (el activo
  // primero), cada uno con su historial de abonos, más un resumen general.
  getEstadoCuentaPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/estado-cuenta`);
    return data;
  },

  // SCRUM-64: el cliente solo manda el monto; la fecha y el usuario los pone el
  // backend.
  registrar: async (pacienteId, monto) => {
    const { data } = await api.post(`/pacientes/${pacienteId}/abonos`, { monto });
    return data;
  },

  // Anulación de un abono: solo admin. La contraseña es la del propio admin
  // logueado (confirmación de una acción que no se puede deshacer) y el motivo es
  // opcional.
  anular: async (pacienteId, abonoId, password, motivo) => {
    const { data } = await api.post(`/pacientes/${pacienteId}/abonos/${abonoId}/anular`, {
      password,
      motivo: motivo || null,
    });
    return data;
  },
};
