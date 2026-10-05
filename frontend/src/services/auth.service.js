import api from './api';

const TOKEN_KEY = 'token';
const ID_USUARIO_KEY = 'idUsuario';
const USUARIO_KEY = 'usuario';
const ROL_KEY = 'rol';
const ES_ADMIN_KEY = 'esAdmin';

export const authService = {
  login: async ({ usuario, clave }) => {
    const { data } = await api.post('/auth/login', { usuario, clave });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ID_USUARIO_KEY, String(data.idUsuario));
    localStorage.setItem(USUARIO_KEY, data.usuario);
    localStorage.setItem(ROL_KEY, data.rol);
    localStorage.setItem(ES_ADMIN_KEY, String(data.esAdmin));
    return data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ID_USUARIO_KEY);
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
      idUsuario: Number(localStorage.getItem(ID_USUARIO_KEY)),
      usuario,
      rol: localStorage.getItem(ROL_KEY) || '',
      esAdmin: localStorage.getItem(ES_ADMIN_KEY) === 'true',
    };
  },

  // SCRUM-231/232/233: pide el enlace de restablecimiento. El backend responde
  // siempre lo mismo, exista o no la cuenta, así que acá no hay nada que decidir.
  solicitarRestablecimiento: async (identificador) => {
    const { data } = await api.post('/auth/olvide-contrasena', { identificador });
    return data;
  },

  // SCRUM-234: valida el token del enlace antes de mostrar el formulario.
  validarTokenRestablecimiento: async (token) => {
    const { data } = await api.post('/auth/restablecer-contrasena/validar', { token });
    return data;
  },

  // SCRUM-234/235/236: guarda la contraseña nueva (el enlace queda sin uso).
  restablecerContrasena: async ({ token, nuevaContrasena, confirmacion }) => {
    const { data } = await api.post('/auth/restablecer-contrasena', { token, nuevaContrasena, confirmacion });
    return data;
  },
};
