export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PACIENTES: '/pacientes',
  PACIENTE_NUEVO: '/pacientes/nuevo',
  PACIENTE_DETALLE: (id) => `/pacientes/${id}`,
  PACIENTE_EDITAR: (id) => `/pacientes/${id}/editar`,
  CALENDARIO: '/calendario',
  RECETARIO: '/recetario',
};
