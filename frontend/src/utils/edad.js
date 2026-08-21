export const calcularEdadDetallada = (fechaISO) => {
  if (!fechaISO) return null;
  const nacimiento = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  if (hoy.getDate() < nacimiento.getDate()) meses--;
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  if (anios < 0) return null;

  return { anios, meses };
};

export const calcularEdadTexto = (fechaISO) => {
  const edad = calcularEdadDetallada(fechaISO);
  return edad ? `${edad.anios} años, ${edad.meses} meses` : '';
};

export const esMenorDeEdad = (fechaISO) => {
  const edad = calcularEdadDetallada(fechaISO);
  return edad !== null && edad.anios < 18;
};
