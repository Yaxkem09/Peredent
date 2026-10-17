import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import PacienteDetail from './PacienteDetail';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';
import { pacientesService } from '../../services/pacientes.service';
import { historiaMedicaService } from '../../services/historia-medica.service';
import { abonosService } from '../../services/abonos.service';
import { AYUDA_EXPEDIENTE } from './ayudaExpediente';

vi.mock('../../services/pacientes.service', () => ({
  pacientesService: { getById: vi.fn() },
}));
vi.mock('../../services/historia-medica.service', () => ({
  historiaMedicaService: { getByPaciente: vi.fn(), guardar: vi.fn() },
}));
vi.mock('../../services/abonos.service', () => ({
  abonosService: { getEstadoCuentaPaciente: vi.fn(), getMetodosPago: vi.fn(), getEstadoCuenta: vi.fn() },
}));

// SCRUM-288: secciones que solo ve el odontólogo.
const SECCIONES_RESTRINGIDAS = [
  'Tratamiento pendiente',
  'Historial de tratamientos',
  'Historial de planes',
  'Presupuesto',
  'Saldo y abonos',
  'Radiografías/Panorámicas',
];

const notify = vi.fn();

const renderExpediente = (rol, url = '/pacientes/1') => {
  const router = createMemoryRouter([{ path: '/pacientes/:id', element: <PacienteDetail /> }], {
    initialEntries: [url],
  });
  return render(
    <AuthContext.Provider value={{ user: { idUsuario: 1, usuario: 'prueba', rol, esAdmin: false } }}>
      <NotificationContext.Provider value={{ notify }}>
        <RouterProvider router={router} />
      </NotificationContext.Provider>
    </AuthContext.Provider>,
  );
};

const esperarExpediente = () => screen.findByRole('navigation', { name: 'Secciones del expediente' });

describe('PacienteDetail - restricción de secciones para la asistente (SCRUM-288)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pacientesService.getById.mockResolvedValue({ id: 1, nombres: 'Ana', apellidos: 'López', telefono: '12345678' });
    historiaMedicaService.getByPaciente.mockResolvedValue(null);
  });

  it('SCRUM-289: la asistente no ve las secciones restringidas en el menú del expediente', async () => {
    renderExpediente('Asistente');
    const menu = await esperarExpediente();

    SECCIONES_RESTRINGIDAS.forEach((seccion) => {
      expect(menu).not.toHaveTextContent(seccion);
    });
    expect(menu).toHaveTextContent('Plan de tratamiento');
    expect(menu).toHaveTextContent('Endodoncia y restauración');
  });

  it('el odontólogo sí ve todas las secciones', async () => {
    renderExpediente('Odontologo');
    const menu = await esperarExpediente();

    SECCIONES_RESTRINGIDAS.forEach((seccion) => {
      expect(menu).toHaveTextContent(seccion);
    });
  });

  it('SCRUM-290: si la asistente entra por URL directa, se le avisa y no se carga la sección', async () => {
    renderExpediente('Asistente', '/pacientes/1?tab=saldo');
    await esperarExpediente();

    await waitFor(() => expect(notify).toHaveBeenCalledWith('No tienes acceso a esa sección del expediente.'));
    expect(abonosService.getEstadoCuentaPaciente).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^datos y contacto$/i })).toHaveAttribute('aria-current', 'page');
  });
});

describe('PacienteDetail - ayuda de cada pestaña (SCRUM-200)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pacientesService.getById.mockResolvedValue({ id: 1, nombres: 'Ana', apellidos: 'López', telefono: '12345678' });
    historiaMedicaService.getByPaciente.mockResolvedValue(null);
  });

  it('SCRUM-201: todas las pestañas del expediente tienen su ayuda', () => {
    const pestanas = [
      'datos', 'historia', 'citas', 'plan', 'pendientes', 'endodoncia', 'historial-planes',
      'historial', 'fotos', 'recetario', 'consentimientos', 'constancias', 'presupuesto', 'saldo',
    ];
    pestanas.forEach((id) => {
      expect(AYUDA_EXPEDIENTE[id]?.resumen).toBeTruthy();
      expect(AYUDA_EXPEDIENTE[id].pasos.length).toBeGreaterThan(0);
    });
  });

  it('SCRUM-203: el texto de cada pestaña es distinto', () => {
    const resumenes = Object.values(AYUDA_EXPEDIENTE).map((a) => a.resumen);
    expect(new Set(resumenes).size).toBe(resumenes.length);
  });

  it('SCRUM-202: el botón inicia la guía de la pestaña activa, empezando por la pestaña', async () => {
    renderExpediente('Odontologo');
    await esperarExpediente();

    fireEvent.click(screen.getByRole('button', { name: /¿cómo se usa “datos y contacto”\?/i }));

    const globo = screen.getByRole('dialog');
    expect(globo).toHaveTextContent('Datos y contacto');
    expect(globo).toHaveTextContent(AYUDA_EXPEDIENTE.datos.resumen);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Identificación');
  });

  it('SCRUM-204: la guía se puede cerrar en cualquier paso sin salir de la pestaña', async () => {
    renderExpediente('Odontologo');
    await esperarExpediente();
    fireEvent.click(screen.getByRole('button', { name: /¿cómo se usa “datos y contacto”\?/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Salir de la guía' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^datos y contacto$/i })).toHaveAttribute('aria-current', 'page');
  });
});
