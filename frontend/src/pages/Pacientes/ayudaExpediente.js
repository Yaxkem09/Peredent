// SCRUM-200: guía de cada pestaña del expediente (SCRUM-202 / SCRUM-203).
// La clave es el id de la pestaña en PacienteDetail. El recorrido empieza en la
// pestaña misma con el "resumen" y sigue por los "pasos": cada uno ilumina el
// elemento del selector y explica para qué sirve. Si un elemento no está en
// pantalla (p. ej. una tabla vacía), ese paso se salta.
export const AYUDA_EXPEDIENTE = {
  datos: {
    resumen: 'Datos personales y de contacto del paciente.',
    pasos: [
      { selector: '.ficha-cabecera', titulo: 'Identificación', texto: 'Nombre, edad y si es menor de edad.' },
      { selector: '.ficha-bloques', titulo: 'Datos y contacto', texto: 'Teléfonos, dirección y, si es menor, los datos del encargado.' },
      { selector: '.ficha-editar', titulo: 'Editar datos', texto: 'Para corregir algo. Cada teléfono debe tener 8 dígitos; el segundo es opcional.' },
    ],
  },
  historia: {
    resumen: 'Antecedentes médicos del paciente: revísalos antes de un procedimiento o una receta.',
    pasos: [
      { selector: '.hm-grid', titulo: 'Antecedentes', texto: 'Cada condición evaluada y si el paciente la presenta.' },
      { selector: '.hm-observaciones-card', titulo: 'Observaciones', texto: 'Notas generales sobre la salud del paciente.' },
      { selector: '.hm .btn-primary', titulo: 'Editar historia médica', texto: 'Marca los antecedentes, escribe observaciones y presiona “Guardar cambios”.' },
    ],
  },
  citas: {
    resumen: 'Todas las citas del paciente, pasadas y próximas. Se crean y mueven desde la Agenda.',
    pasos: [
      { selector: '.hc-filtros', titulo: 'Filtrar citas', texto: 'Filtra por fechas, odontólogo o estado para encontrar una cita.' },
      { selector: '.hc-table', titulo: 'Lista de citas', texto: 'Fecha, hora, odontólogo, estado y notas de cada cita.' },
      { selector: '.hc-ver-agenda', titulo: 'Ver en agenda', texto: 'Abre esa cita en el calendario.' },
    ],
  },
  plan: {
    resumen: 'Plan de tratamiento activo: qué se le hará en cada pieza y cuánto cuesta.',
    pasos: [
      { selector: '.plan-tablas', titulo: 'Piezas dentales', texto: 'Escribe el tratamiento y el valor en la fila de cada pieza. Una pieza sin valor queda “Pendiente de precio”.' },
      { selector: '.plan-cierre', titulo: 'Observaciones y resumen', texto: 'Notas del plan, descuento y el total, que se calcula solo.' },
      { selector: '.plan-acciones-botones .btn-primary', titulo: 'Guardar cambios del plan', texto: 'Guarda al terminar. Si intentas salir sin guardar, el sistema te avisa.' },
      { selector: '.plan-acciones-botones .btn-outline-teal', titulo: 'Finalizar este plan', texto: 'Cuando todas las piezas estén completadas, pasa el plan al historial.' },
    ],
  },
  pendientes: {
    resumen: 'Tratamientos del plan actual que todavía no se han realizado.',
    pasos: [
      { selector: '.tx-pendiente-total', titulo: 'Por realizar', texto: 'Monto de los tratamientos que faltan.' },
      { selector: '.tx-pendiente-table', titulo: 'Tratamientos pendientes', texto: 'Cada pieza con el tratamiento que le falta por realizar.' },
      { selector: '.tx-pendiente-table tbody tr button', titulo: 'Marcar como completado', texto: 'Úsalo solo cuando estés seguro de que el tratamiento en esa pieza terminó. Se pide confirmación y la pieza pasa al historial.' },
    ],
  },
  endodoncia: {
    resumen: 'Medidas de endodoncia por pieza, tratamiento periodontal y prótesis.',
    pasos: [
      { selector: '.endo-table-wrapper', titulo: 'Medidas por pieza', texto: 'Con “+ Agregar pieza” registras mm, diámetro, cúspide y obturación.' },
      { selector: '.endo-panel-tx', titulo: 'Tratamiento periodontal', texto: 'Actívalo si aplica y describe el tratamiento.' },
      { selector: '.endo-card .endo-acciones', titulo: 'Guardar registro', texto: 'Guarda la parte de endodoncia. Si sales con cambios sin guardar, el sistema te avisa.' },
      { selector: '.protesis-checkboxes', titulo: 'Prótesis', texto: 'Marca la indicación protésica; se guarda aparte con “Guardar prótesis”.' },
    ],
  },
  'historial-planes': {
    resumen: 'Planes de tratamiento anteriores que ya se finalizaron. Es solo de consulta.',
    pasos: [
      { selector: '.historial-lista', titulo: 'Planes anteriores', texto: 'Haz clic en un plan para ver sus piezas, tratamientos y totales.' },
    ],
  },
  historial: {
    resumen: 'Todos los tratamientos realizados al paciente, de todos sus planes.',
    pasos: [
      { selector: '.htx-filtros', titulo: 'Filtrar tratamientos', texto: 'Filtra por pieza dental para ver todo lo que se le ha hecho a una pieza.' },
      { selector: '.htx-table', titulo: 'Tratamientos realizados', texto: 'Pieza, tratamiento, estado y fechas. Es solo de consulta.' },
    ],
  },
  fotos: {
    resumen: 'Radiografías, panorámicas y documentos del paciente.',
    pasos: [
      { selector: '.panoramicas-dropzone', titulo: 'Subir archivos', texto: 'Arrastra o elige imágenes JPG/PNG o documentos Word (.docx) de hasta 15 MB.' },
      { selector: '.panoramicas-grid', titulo: 'Archivos del paciente', texto: 'Haz clic en uno para verlo en grande y pasar al anterior o al siguiente.' },
    ],
  },
  recetario: {
    resumen: 'Recetas médicas emitidas a este paciente.',
    pasos: [
      { selector: '.recetario-acciones', titulo: 'Nueva receta', texto: 'Agrega los medicamentos y sus indicaciones.' },
      { selector: '.recetario-lista', titulo: 'Recetas emitidas', texto: 'Abre una receta para verla o imprimirla.' },
    ],
  },
  consentimientos: {
    resumen: 'Consentimientos informados del paciente.',
    pasos: [
      { selector: '.recetario-acciones', titulo: 'Nuevo consentimiento', texto: 'Completa los datos del procedimiento e imprímelo para que el paciente lo firme.' },
      { selector: '.recetario-lista', titulo: 'Consentimientos emitidos', texto: 'Fecha, procedimiento y doctor de cada uno.' },
    ],
  },
  constancias: {
    resumen: 'Constancias odontológicas emitidas al paciente.',
    pasos: [
      { selector: '.recetario-acciones', titulo: 'Emitir una constancia', texto: 'La primera vez registra tus datos profesionales. Luego elige el tipo: “Extracción de terceras molares” o “Tratamiento realizado”.' },
      { selector: '.recetario-lista', titulo: 'Constancias emitidas', texto: 'No se editan: si una tiene un error, genera una nueva.' },
      { selector: '.constancia-item-ver', titulo: 'Ver / imprimir', texto: 'Vuelve a abrir la constancia tal como se emitió.' },
    ],
  },
  presupuesto: {
    resumen: 'Presupuesto del plan activo, listo para entregar al paciente. Se arma con lo guardado en el plan.',
    pasos: [
      { selector: '.presupuesto-table', titulo: 'Detalle', texto: 'Piezas, tratamientos y valores del plan, con descuento y total.' },
      { selector: '.presupuesto-acciones', titulo: 'Descargar o imprimir', texto: 'Genera el PDF. Si cambiaste el plan, guárdalo primero para que se actualice.' },
    ],
  },
  saldo: {
    resumen: 'Lo que el paciente ha pagado y lo que todavía debe en cada plan.',
    pasos: [
      { selector: '.saldo-resumen', titulo: 'Resumen', texto: 'Total de tratamientos, lo abonado y el saldo pendiente de todos sus planes.' },
      { selector: '.saldo-form', titulo: 'Registrar abono', texto: 'Monto y método de pago (efectivo o transferencia). No puede ser mayor que el saldo pendiente.' },
      { selector: '.saldo-table-wrap', titulo: 'Historial de abonos', texto: 'Cada abono con su método y el saldo que quedó. Para corregir uno, usa “Editar” (pide tu contraseña).' },
    ],
  },
};
