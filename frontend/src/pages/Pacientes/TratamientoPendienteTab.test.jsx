import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TratamientoPendienteTab from './TratamientoPendienteTab';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { NotificationProvider } from '../../context/NotificationContext';

// Mockeo el servicio completo: así controlo getPendientes (datos iniciales de
// la tabla) y completarPendiente (lo que debe o no dispararse según el pop-up).
vi.mock('../../services/plan-tratamiento.service', () => ({
  planTratamientoService: {
    getPendientes: vi.fn(),
    completarPendiente: vi.fn(),
  },
}));

const pendientesMock = [
  { pieza: '21l', tratamiento: 'Resina', valor: 350, fechaRegistroPlan: '2026-01-10', estado: 'Pendiente' },
  { pieza: '5b', tratamiento: 'Limpieza', valor: 200, fechaRegistroPlan: '2026-01-10', estado: 'Pendiente' },
];

// El componente usa useNotification(), que exige un NotificationProvider en
// el árbol; lo envuelvo acá en vez de mockear el hook para probar el flujo real.
const renderTab = () =>
  render(
    <NotificationProvider>
      <TratamientoPendienteTab idPaciente={7} />
    </NotificationProvider>,
  );

describe('TratamientoPendienteTab - confirmación al completar (SCRUM-279)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planTratamientoService.getPendientes.mockResolvedValue(pendientesMock);
    planTratamientoService.completarPendiente.mockResolvedValue([]);
  });

  const abrirModalDe = async (user, pieza) => {
    const fila = (await screen.findByText(pieza)).closest('tr');
    await user.click(within(fila).getByRole('button', { name: /marcar como completado/i }));
  };

  it('muestra el número de pieza real de la fila en la pregunta del pop-up', async () => {
    const user = userEvent.setup();
    renderTab();

    await abrirModalDe(user, '21l');

    expect(
      screen.getByRole('heading', { name: '¿Confirma que se terminó el tratamiento en la pieza 21l?' }),
    ).toBeInTheDocument();
    // No debe pedir contraseña ni ningún otro input (SCRUM-281).
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
  });

  it('al confirmar, llama a completarPendiente una sola vez con los argumentos correctos', async () => {
    const user = userEvent.setup();
    renderTab();

    await abrirModalDe(user, '5b');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(planTratamientoService.completarPendiente).toHaveBeenCalledTimes(1);
    expect(planTratamientoService.completarPendiente).toHaveBeenCalledWith(7, '5b');
  });

  it('al cancelar, no llama a la API y cierra el modal sin cambiar la fila', async () => {
    const user = userEvent.setup();
    renderTab();

    await abrirModalDe(user, '21l');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(planTratamientoService.completarPendiente).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // La fila sigue intacta: el botón vuelve a mostrar su texto normal, no "Guardando…".
    const fila = screen.getByText('21l').closest('tr');
    expect(within(fila).getByRole('button', { name: /marcar como completado/i })).toBeInTheDocument();
  });
});
