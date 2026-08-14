import api from './api';

export const citasService = {
  getAll: async () => {
    const { data } = await api.get('/citas');
    return data;
  },

  getProximas: async () => {
    const { data } = await api.get('/citas/proximas');
    return data;
  },

  getByPaciente: async (pacienteId) => {
    const { data } = await api.get(`/citas/paciente/${pacienteId}`);
    return data;
  },

  create: async (cita) => {
    const { data } = await api.post('/citas', cita);
    return data;
  },

  update: async (id, cita) => {
    const { data } = await api.put(`/citas/${id}`, cita);
    return data;
  },

  confirmar: async (id) => {
    const { data } = await api.patch(`/citas/${id}/confirmar`);
    return data;
  },

  cancelar: async (id) => {
    const { data } = await api.patch(`/citas/${id}/cancelar`);
    return data;
  },
};
