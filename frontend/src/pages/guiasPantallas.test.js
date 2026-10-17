import { describe, it, expect } from 'vitest';
import { GUIA_ADMINISTRACION, GUIA_AGENDA, GUIA_DASHBOARD, GUIA_PACIENTES } from './guiasPantallas';
import { AYUDA_EXPEDIENTE } from './Pacientes/ayudaExpediente';

const GUIAS = {
  dashboard: GUIA_DASHBOARD,
  agenda: GUIA_AGENDA,
  pacientes: GUIA_PACIENTES,
  administracion: GUIA_ADMINISTRACION,
  ...Object.fromEntries(Object.entries(AYUDA_EXPEDIENTE).map(([id, a]) => [`expediente:${id}`, a.pasos])),
};

describe('Guías de uso', () => {
  it.each(Object.entries(GUIAS))('%s: cada paso tiene selector válido, título y texto', (_, pasos) => {
    expect(pasos.length).toBeGreaterThan(0);
    pasos.forEach((paso) => {
      expect(() => document.querySelector(paso.selector)).not.toThrow();
      expect(paso.titulo).toBeTruthy();
      expect(paso.texto).toBeTruthy();
    });
  });
});
