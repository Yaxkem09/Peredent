import api from './api';

export const pacientesService = {
  getAll: async () => {
    const { data } = await api.get('/pacientes');
    return data;
  },

  getById: async (id) => {
    const { data } = await api.get(`/pacientes/${id}`);
    return data;
  },

  search: async (query) => {
    const { data } = await api.get('/pacientes/search', { params: { q: query } });
    return data;
  },

  create: async (paciente) => {
    const { data } = await api.post('/pacientes', paciente);
    return data;
  },

  update: async (id, paciente) => {
    const { data } = await api.put(`/pacientes/${id}`, paciente);
    return data;
  },

  remove: async (id) => {
    await api.delete(`/pacientes/${id}`);
  },
};
