import api from './api';

export const citasService = {
  // desde/hasta en formato yyyy-MM-dd; trae solo las citas del rango visible
  // en la vista de agenda (día/semana/mes), no todas las citas del sistema.
  // idUsuario filtra por el calendario de un solo odontólogo; si el usuario
  // logueado es Odontólogo, el backend lo fuerza a su propio id sin importar
  // lo que se mande acá.
  getAll: async ({ desde, hasta, idUsuario } = {}) => {
    const { data } = await api.get('/citas', { params: { desde, hasta, idUsuario } });
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

  // Catálogo de estados de cita (Pendiente, Confirmada, Atendida, Cancelada, No Asistio),
  // para el selector de estado del modal de editar cita.
  getEstados: async () => {
    const { data } = await api.get('/citas/estados');
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
