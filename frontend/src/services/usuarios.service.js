import api from './api';

export const usuariosService = {
  getAll: async () => {
    const { data } = await api.get('/usuarios');
    return data;
  },

  getRoles: async () => {
    const { data } = await api.get('/usuarios/roles');
    return data;
  },

  create: async (usuario) => {
    const { data } = await api.post('/usuarios', usuario);
    return data;
  },

  habilitar: async (id) => {
    const { data } = await api.patch(`/usuarios/${id}/habilitar`);
    return data;
  },

  deshabilitar: async (id) => {
    const { data } = await api.patch(`/usuarios/${id}/deshabilitar`);
    return data;
  },

  otorgarAdmin: async (id) => {
    const { data } = await api.patch(`/usuarios/${id}/otorgar-admin`);
    return data;
  },

  revocarAdmin: async (id) => {
    const { data } = await api.patch(`/usuarios/${id}/revocar-admin`);
    return data;
  },
};
