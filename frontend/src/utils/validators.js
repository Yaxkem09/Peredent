// Aquí van funciones de validación como validateEmail, validatePassword, validatePhone, validateDNI, validateDate. Retornan boolean o detalle de errores.

const CODIGO_GUATEMALA = '502';
const DIGITOS_LOCALES_GUATEMALA = 8;

// Misma regla que TelefonoWhatsApp.Normalizar del backend: solo dígitos; 8
// dígitos se asumen de Guatemala y se les antepone 502; 502 + 8 dígitos se deja
// igual. Cualquier otra cosa no se puede usar para WhatsApp (devuelve null).
// Ej.: "5123-4567", "5123 4567", "+502 5123 4567" => "50251234567".
export const normalizarTelefonoWhatsApp = (telefono) => {
  const digitos = String(telefono ?? '').replace(/\D/g, '');

  if (digitos.length === DIGITOS_LOCALES_GUATEMALA) {
    return CODIGO_GUATEMALA + digitos;
  }

  if (digitos.length === CODIGO_GUATEMALA.length + DIGITOS_LOCALES_GUATEMALA && digitos.startsWith(CODIGO_GUATEMALA)) {
    return digitos;
  }

  return null;
};

export const esTelefonoWhatsAppValido = (telefono) => normalizarTelefonoWhatsApp(telefono) !== null;
