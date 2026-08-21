import api from './api';

export const historiaMedicaService = {
  getCondiciones: async () => {
    const { data } = await api.get('/condiciones');
    return data;
  },

  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/historia-medica`);
    return data;
  },

  guardar: async (pacienteId, historiaMedica) => {
    const { data } = await api.put(`/pacientes/${pacienteId}/historia-medica`, historiaMedica);
    return data;
  },
};
