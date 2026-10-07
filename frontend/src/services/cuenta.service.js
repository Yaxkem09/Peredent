import api from './api';

// SCRUM-237 a 239: configuración de la propia cuenta (datos, correo y contraseña).
export const cuentaService = {
  get: async () => {
    const { data } = await api.get('/cuenta');
    return data;
  },

  // Cambio del nombre de usuario; se confirma con la contraseña actual. La
  // respuesta trae un token nuevo (el nombre va dentro del token).
  actualizarUsuario: async ({ nombreUsuario, contrasenaActual }) => {
    const { data } = await api.put('/cuenta/usuario', { nombreUsuario, contrasenaActual });
    return data;
  },

  // Cambio del correo; se confirma con la contraseña actual.
  actualizarCorreo: async ({ correo, contrasenaActual }) => {
    const { data } = await api.put('/cuenta/correo', { correo, contrasenaActual });
    return data;
  },

  cambiarContrasena: async ({ contrasenaActual, nuevaContrasena, confirmacion }) => {
    const { data } = await api.put('/cuenta/cambiar-contrasena', {
      contrasenaActual,
      nuevaContrasena,
      confirmacion,
    });
    return data;
  },
};
