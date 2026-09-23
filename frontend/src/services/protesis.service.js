import api from './api';

export const protesisService = {
  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/protesis`);
    return data;
  },

  guardar: async (pacienteId, payload) => {
    const { data } = await api.put(`/pacientes/${pacienteId}/protesis`, payload);
    return data;
  },
};