import api from './api';

export const recetarioService = {
  getByPaciente: async (idPaciente) => {
    const { data } = await api.get(`/pacientes/${idPaciente}/recetario`);
    return data;
  },

  // SCRUM-101: menú principal, busca recetas de todos los pacientes por
  // nombre/apellido. Sin texto, trae solo las más recientes.
  buscar: async (texto) => {
    const { data } = await api.get('/recetario', { params: { buscar: texto || undefined } });
    return data;
  },

  crear: async (idPaciente, receta) => {
    const { data } = await api.post(`/pacientes/${idPaciente}/recetario`, receta);
    return data;
  },

  eliminar: async (idPaciente, idReceta) => {
    await api.delete(`/pacientes/${idPaciente}/recetario/${idReceta}`);
  },

  descargarPdf: async (idPaciente, idReceta) => {
    const respuesta = await api.get(`/pacientes/${idPaciente}/recetario/${idReceta}/pdf`, {
      responseType: 'blob',
    });
    return respuesta;
  },

  // SCRUM-93: datos del odontólogo/clínica de la última receta que emitió el
  // usuario en sesión, para precargar el formulario de "Nueva receta".
  // Devuelve null si todavía no ha emitido ninguna.
  getPerfilOdontologo: async () => {
    const { data, status } = await api.get('/recetario/perfil');
    return status === 204 ? null : data;
  },
};
