import api from './api';

export const authService = {
  login: async ({ usuario, clave }) => {
    const { data } = await api.post('/auth/login', { usuario, clave });
    localStorage.setItem('token', data.token);
    return data;
  },
};
