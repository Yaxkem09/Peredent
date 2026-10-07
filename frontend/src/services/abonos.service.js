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

  // SCRUM-64: el cliente manda el monto y el plan sobre el que abona (activo o
  // un plan cerrado con saldo pendiente); la fecha y el usuario los pone el backend.
  registrar: async (pacienteId, monto, idPresupuestoPlan) => {
    const { data } = await api.post(`/pacientes/${pacienteId}/abonos`, {
      monto,
      idPresupuestoPlan: idPresupuestoPlan ?? null,
    });
    return data;
  },

  // Edición del monto de un abono: solo admin, confirmada con la contraseña del
  // admin logueado. Devuelve el estado de cuenta recalculado del plan.
  editar: async (pacienteId, abonoId, monto, password) => {
    const { data } = await api.post(`/pacientes/${pacienteId}/abonos/${abonoId}/editar`, {
      monto,
      password,
    });
    return data;
  },

  // Anulación de un abono: solo admin. (La pantalla ya no la ofrece: se edita.) La contraseña es la del propio admin
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
