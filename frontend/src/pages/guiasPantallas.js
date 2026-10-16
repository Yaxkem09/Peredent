// Recorridos guiados de las pantallas del menú principal (mismo formato que
// ayudaExpediente.js). Cada paso ilumina el elemento del selector; si no está
// en pantalla (p. ej. una sección que el rol no ve), ese paso se salta.

export const GUIA_DASHBOARD = [
  { selector: '.dashboard .page-head', titulo: 'Dashboard', texto: 'Resumen del día y accesos rápidos a la agenda y a registrar un paciente nuevo.' },
  { selector: '.stat-grid', titulo: 'Números del día', texto: 'Pacientes registrados y cuántas citas hay hoy y mañana.' },
  { selector: '.dashboard-columns .tono-accent', titulo: 'Por atender hoy', texto: 'Citas de hoy que todavía no se atienden. Haz clic en una para abrir el expediente del paciente.' },
  { selector: '.dashboard-columns .tono-amber', titulo: 'Agenda de mañana', texto: 'Citas programadas para mañana, para prepararte con tiempo.' },
  { selector: '.dash-pagos', titulo: 'Pagos recibidos', texto: 'Lo cobrado en el día y en la semana, separado en efectivo y transferencia. Se actualiza solo.' },
  { selector: '.dash-semanas', titulo: 'Cambiar de semana', texto: 'Con las flechas ves semanas anteriores; “Ir a esta semana” regresa a la actual.' },
  { selector: '.dash-pagos-dias', titulo: 'Elegir un día', texto: 'Muestra lo cobrado en ese día de la semana.' },
  { selector: '.dash-saldos', titulo: 'Saldos pendientes', texto: 'Pacientes que más deben y el total por cobrar. Haz clic en uno para abrir su saldo; “Ver todos” muestra la lista completa.' },
];

export const GUIA_AGENDA = [
  { selector: '.agenda-titulo', titulo: 'Agenda', texto: 'La fecha o el periodo que estás viendo.' },
  { selector: '.agenda-leyenda', titulo: 'Estados de cita', texto: 'Qué significa cada color. Las citas canceladas aparecen tachadas.' },
  { selector: '.view-switch', titulo: 'Día, semana o mes', texto: 'Cambia cómo ves la agenda.' },
  { selector: '.day-nav', titulo: 'Moverte en el calendario', texto: 'Las flechas avanzan o retroceden; “Hoy” regresa al día actual.' },
  { selector: '.odontologo-selector', titulo: 'Agenda del odontólogo', texto: 'Elige de qué odontólogo ves la agenda; las citas nuevas se le agendan a él.' },
  { selector: '.agenda-nueva-cita', titulo: 'Nueva cita', texto: 'Agenda una cita: paciente, fecha, hora y duración.' },
  { selector: '.agenda-bloqueo-btn', titulo: 'Día no laboral', texto: 'Bloquea el día para que no se agenden citas (por ejemplo, vacaciones o feriados). En la vista semana, primero elige el día haciendo clic en su encabezado.' },
  { selector: '.day-agenda, .week-agenda, .month-wrap', titulo: 'Citas', texto: 'Haz clic en una cita para verla, editarla o cambiar su estado. En las vistas de día y semana también puedes arrastrarla a otro horario.' },
];

export const GUIA_PACIENTES = [
  { selector: '.pacientes-page .page-head', titulo: 'Pacientes', texto: 'Todos los pacientes de la clínica y su expediente.' },
  { selector: '.pacientes-nuevo', titulo: 'Nuevo paciente', texto: 'Registra a un paciente con sus datos personales y de contacto.' },
  { selector: '.pacientes-buscador', titulo: 'Buscar', texto: 'Escribe nombre, apellido o teléfono para encontrar a un paciente.' },
  { selector: '.patient-row', titulo: 'Paciente', texto: 'Haz clic en la fila para abrir su expediente completo.' },
  { selector: '.patient-quick-actions', titulo: 'Accesos rápidos', texto: '“Ficha” abre sus datos y “Plan”, su plan de tratamiento.' },
];

export const GUIA_ADMINISTRACION = [
  { selector: '.admin-page .page-head', titulo: 'Administración de usuarios', texto: 'Cuentas del personal que puede entrar al sistema. Solo la ven los administradores.' },
  { selector: '.admin-nuevo', titulo: 'Nuevo usuario', texto: 'Crea una cuenta con usuario, correo, contraseña inicial y rol (odontólogo o asistente).' },
  { selector: '.admin-stats', titulo: 'Resumen', texto: 'Cuántos usuarios hay, activos, inactivos y administradores.' },
  { selector: '.admin-toolbar', titulo: 'Buscar y filtrar', texto: 'Busca por usuario, correo o rol, o filtra por estado.' },
  { selector: '.users-table', titulo: 'Usuarios', texto: 'Rol, estado, si es administrador y la fecha y hora de su último acceso.' },
  { selector: '.users-table-acciones', titulo: 'Acciones', texto: '“Deshabilitar” le quita el acceso sin borrar la cuenta; “Dar admin” le permite gestionar usuarios. No puedes modificar tu propio usuario.' },
];
