import api from './api';

export const panoramicasService = {
  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/pacientes/${pacienteId}/panoramicas`);
    return data;
  },

  subir: async (pacienteId, archivo) => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    const { data } = await api.post(`/pacientes/${pacienteId}/panoramicas`, formData);
    return data;
  },

  eliminar: async (id) => {
    await api.delete(`/panoramicas/${id}`);
  },
};
