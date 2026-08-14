import api from './api';

export const inventarioService = {
  getAll: async () => {
    const { data } = await api.get('/inventario');
    return data;
  },

  getStockBajo: async () => {
    const { data } = await api.get('/inventario/stock-bajo');
    return data;
  },

  getVencidos: async () => {
    const { data } = await api.get('/inventario/vencidos');
    return data;
  },

  create: async (item) => {
    const { data } = await api.post('/inventario', item);
    return data;
  },

  update: async (id, item) => {
    const { data } = await api.put(`/inventario/${id}`, item);
    return data;
  },

  remove: async (id) => {
    await api.delete(`/inventario/${id}`);
  },
};
