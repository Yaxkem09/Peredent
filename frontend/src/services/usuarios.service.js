import api from './api';

export const usuariosService = {
  getAll: async () => {
    const { data } = await api.get('/usuarios');
    return data;
  },
};
