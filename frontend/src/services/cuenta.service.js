import api from './api';

// SCRUM-237 a 239: configuración de la propia cuenta (datos, correo y contraseña).
export const cuentaService = {
  get: async () => {
    const { data } = await api.get('/cuenta');
    return data;
  },

  // El correo es el único dato editable; se confirma con la contraseña actual.
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
