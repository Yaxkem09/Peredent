import api from './api';

export const planTratamientoService = {
  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/plan-tratamiento`);
    return data;
  },

  guardar: async (pacienteId, planTratamiento) => {
    const { data } = await api.put(`/pacientes/${pacienteId}/plan-tratamiento`, planTratamiento);
    return data;
  },

  finalizar: async (pacienteId) => {
    const { data } = await api.post(`/pacientes/${pacienteId}/plan-tratamiento/finalizar`);
    return data;
  },

  getHistorial: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/plan-tratamiento/historial`);
    return data;
  },

  getPendientes: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/plan-tratamiento/pendientes`);
    return data;
  },

  completarPendiente: async (pacienteId, pieza) => {
    const { data } = await api.put(
      `/pacientes/${pacienteId}/plan-tratamiento/pendientes/${encodeURIComponent(pieza)}/completar`,
    );
    return data;
  },
};
