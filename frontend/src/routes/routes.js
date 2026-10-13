export const ROUTES = {
  LOGIN: '/login',
  // SCRUM-231: pantallas públicas de recuperación de contraseña.
  OLVIDE_CONTRASENA: '/olvide-contrasena',
  RESTABLECER_CONTRASENA: '/restablecer-contrasena',
  DASHBOARD: '/dashboard',
  PACIENTES: '/pacientes',
  PACIENTE_NUEVO: '/pacientes/nuevo',
  PACIENTE_DETALLE: (id) => `/pacientes/${id}`,
  PACIENTE_EDITAR: (id) => `/pacientes/${id}/editar`,
  CALENDARIO: '/calendario',
  RECETARIO: '/recetario',
  ADMINISTRACION: '/administracion',
  // SCRUM-237: configuración de la propia cuenta.
  CONFIGURACION: '/configuracion',
};
