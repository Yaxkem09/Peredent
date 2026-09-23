import api from './api';

export const bloqueosAgendaService = {
  // desde/hasta en formato yyyy-MM-dd; idUsuario filtra por odontólogo (mismo
  // patrón que citasService.getAll -- el backend fuerza el propio id si el
  // usuario logueado es Odontólogo).
  getAll: async ({ desde, hasta, idUsuario } = {}) => {
    const { data } = await api.get('/bloqueos-agenda', { params: { desde, hasta, idUsuario } });
    return data;
  },

  // Solo el odontólogo dueño de la agenda puede crear/borrar sus bloqueos;
  // el backend ya lo obliga a usar su propio id, sin importar lo que se mande.
  create: async ({ fecha, motivo }) => {
    const { data } = await api.post('/bloqueos-agenda', { fecha, motivo });
    return data;
  },

  eliminar: async (id) => {
    await api.delete(`/bloqueos-agenda/${id}`);
  },
};
