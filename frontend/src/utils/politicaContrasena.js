// SCRUM-235 / SCRUM-239: las mismas reglas que PoliticaContrasena.Validar del
// backend, para avisar en el cliente antes de mandar la petición (el backend
// valida igual y es el que manda).
export const REGLAS_POLITICA_CONTRASENA = [
  'Al menos 8 caracteres (máximo 128).',
  'Al menos una letra mayúscula.',
  'Al menos una letra minúscula.',
  'Al menos un número.',
];

const MAYUSCULA = /\p{Lu}/u;
const MINUSCULA = /\p{Ll}/u;
const NUMERO = /\p{Nd}/u;

// Devuelve el mensaje del primer requisito que no se cumple, o null si está bien.
export const validarPoliticaContrasena = (clave) => {
  if (!clave) {
    return 'La contraseña es obligatoria.';
  }

  if (clave.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (clave.length > 128) {
    return 'La contraseña no puede tener más de 128 caracteres.';
  }

  if (!MAYUSCULA.test(clave)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }

  if (!MINUSCULA.test(clave)) {
    return 'La contraseña debe incluir al menos una letra minúscula.';
  }

  if (!NUMERO.test(clave)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  return null;
};
