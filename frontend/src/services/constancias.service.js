import api from './api';

// SCRUM-294: constancias odontológicas del expediente. No hay editar ni
// eliminar: una constancia emitida no se modifica (SCRUM-302).
export const constanciasService = {
  getByPaciente: async (idPaciente) => {
    const { data } = await api.get(`/pacientes/${idPaciente}/constancias`);
    return data;
  },

  // Tipos de constancia, datos del odontólogo en sesión para el pie (null si
  // aún no los registró en el recetario) y lugar de su última constancia.
  getDatosNueva: async () => {
    const { data } = await api.get('/constancias/datos-nueva');
    return data;
  },

  crear: async (idPaciente, constancia) => {
    const { data } = await api.post(`/pacientes/${idPaciente}/constancias`, constancia);
    return data;
  },

  descargarPdf: async (idPaciente, idConstancia) => {
    const respuesta = await api.get(`/pacientes/${idPaciente}/constancias/${idConstancia}/pdf`, {
      responseType: 'blob',
    });
    return respuesta;
  },
};
