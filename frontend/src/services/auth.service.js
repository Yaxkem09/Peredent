import api from './api';

const TOKEN_KEY = 'token';
const USUARIO_KEY = 'usuario';

export const authService = {
  login: async ({ usuario, clave }) => {
    const { data } = await api.post('/auth/login', { usuario, clave });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USUARIO_KEY, data.usuario);
    return data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
  },

  isAuthenticated: () => Boolean(localStorage.getItem(TOKEN_KEY)),

  getToken: () => localStorage.getItem(TOKEN_KEY),

  getUsuarioActual: () => {
    const usuario = localStorage.getItem(USUARIO_KEY);
    return usuario ? { usuario } : null;
  },
};
