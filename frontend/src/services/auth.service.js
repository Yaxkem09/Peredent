import api from './api';

const TOKEN_KEY = 'token';
const USUARIO_KEY = 'usuario';
const ROL_KEY = 'rol';
const ES_ADMIN_KEY = 'esAdmin';

export const authService = {
  login: async ({ usuario, clave }) => {
    const { data } = await api.post('/auth/login', { usuario, clave });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USUARIO_KEY, data.usuario);
    localStorage.setItem(ROL_KEY, data.rol);
    localStorage.setItem(ES_ADMIN_KEY, String(data.esAdmin));
    return data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    localStorage.removeItem(ROL_KEY);
    localStorage.removeItem(ES_ADMIN_KEY);
  },

  isAuthenticated: () => Boolean(localStorage.getItem(TOKEN_KEY)),

  getToken: () => localStorage.getItem(TOKEN_KEY),

  getUsuarioActual: () => {
    const usuario = localStorage.getItem(USUARIO_KEY);
    if (!usuario) {
      return null;
    }
    return {
      usuario,
      rol: localStorage.getItem(ROL_KEY) || '',
      esAdmin: localStorage.getItem(ES_ADMIN_KEY) === 'true',
    };
  },
};
