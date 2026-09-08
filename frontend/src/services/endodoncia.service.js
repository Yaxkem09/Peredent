import api from './api';

export const endodonciaService = {
  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/endodoncia`);
    return data;
  },

  guardar: async (pacienteId, payload) => {
    const { data } = await api.put(`/pacientes/${pacienteId}/endodoncia`, payload);
    return data;
  },
};