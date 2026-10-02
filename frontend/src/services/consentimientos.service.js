import api from './api';

// SCRUM-254: consentimiento informado de exodoncia de terceros molares.
export const consentimientosService = {
  getByPaciente: async (idPaciente) => {
    const { data } = await api.get(`/pacientes/${idPaciente}/consentimientos`);
    return data;
  },

  // Doctor/colegiado/lugar del último consentimiento del usuario en sesión.
  // Devuelve null si todavía no ha hecho ninguno.
  getUltimoDelUsuario: async () => {
    const { data, status } = await api.get('/consentimientos/ultimo');
    return status === 204 ? null : data;
  },

  crear: async (idPaciente, consentimiento) => {
    const { data } = await api.post(`/pacientes/${idPaciente}/consentimientos`, consentimiento);
    return data;
  },

  actualizar: async (idPaciente, idConsentimiento, consentimiento) => {
    const { data } = await api.put(
      `/pacientes/${idPaciente}/consentimientos/${idConsentimiento}`,
      consentimiento,
    );
    return data;
  },

  // Genera el PDF y, en el backend, lo marca como Impreso y registra quién
  // lo imprimió y cuándo (SCRUM-263).
  imprimir: async (idPaciente, idConsentimiento) => {
    const respuesta = await api.post(
      `/pacientes/${idPaciente}/consentimientos/${idConsentimiento}/imprimir`,
      null,
      { responseType: 'blob' },
    );
    return respuesta;
  },
};
