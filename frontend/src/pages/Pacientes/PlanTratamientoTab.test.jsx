import { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlanTratamientoTab from './PlanTratamientoTab';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { NotificationContext } from '../../context/NotificationContext';

// Mockeo el servicio real (SCRUM-283 no toca backend, solo la UI de aviso de cambios sin guardar).
vi.mock('../../services/plan-tratamiento.service', () => ({
  planTratamientoService: {
    getByPaciente: vi.fn(),
    guardar: vi.fn(),
    finalizar: vi.fn(),
  },
}));

const planVacio = {
  piezas: [],
  descuento: 0,
  observacionesGenerales: '',
  fechaInicio: null,
};

// Harness que reproduce el mismo contrato que usa PacienteDetail: una ref con
// "intentarCambiarTab" y un callback "onCambiarTab" que sí mueve la pestaña.
// Así pruebo la integración real sin tener que montar todo PacienteDetail.
const Harness = () => {
  const ref = useRef(null);
  const [tab, setTab] = useState('plan');

  const irAOtraPestana = () => {
    if (tab === 'plan') {
      ref.current?.intentarCambiarTab('otra');
    } else {
      setTab('otra');
    }
  };

  return (
    <NotificationContext.Provider value={{ notify: vi.fn() }}>
      <button type="button" onClick={irAOtraPestana}>
        Ir a otra pestaña
      </button>
      <div data-testid="tab-actual">{tab}</div>
      {tab === 'plan' && <PlanTratamientoTab idPaciente={1} ref={ref} onCambiarTab={setTab} />}
    </NotificationContext.Provider>
  );
};

const esperarCarga = async () => screen.findByLabelText('Observaciones generales');

const marcarComoSucio = async (texto = 'Nota nueva') => {
  const observaciones = await esperarCarga();
  fireEvent.change(observaciones, { target: { value: texto } });
  return observaciones;
};

describe('PlanTratamientoTab - aviso de cambios sin guardar (SCRUM-283)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planTratamientoService.getByPaciente.mockResolvedValue(planVacio);
  });

  it('SCRUM-284: con cambios sin guardar, al intentar cambiar de pestaña aparece el aviso y la pestaña no cambia', async () => {
    render(<Harness />);
    await marcarComoSucio();

    fireEvent.click(screen.getByText('Ir a otra pestaña'));

    expect(
      screen.getByText('Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('plan');
  });

  it('SCRUM-285: "Guardar y salir" guarda con el servicio y luego cambia de pestaña', async () => {
    planTratamientoService.guardar.mockResolvedValue(planVacio);
    render(<Harness />);
    await marcarComoSucio('Observación importante');

    fireEvent.click(screen.getByText('Ir a otra pestaña'));
    fireEvent.click(screen.getByRole('button', { name: /guardar y salir/i }));

    await waitFor(() => expect(planTratamientoService.guardar).toHaveBeenCalledTimes(1));
    expect(planTratamientoService.guardar).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ observacionesGenerales: 'Observación importante' }),
    );
    await waitFor(() => expect(screen.getByTestId('tab-actual')).toHaveTextContent('otra'));
  });

  it('SCRUM-285: "Cancelar" no pierde lo escrito ni cambia de pestaña', async () => {
    render(<Harness />);
    const observaciones = await marcarComoSucio('No se debe perder esto');

    fireEvent.click(screen.getByText('Ir a otra pestaña'));
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(planTratamientoService.guardar).not.toHaveBeenCalled();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('plan');
    expect(observaciones).toHaveValue('No se debe perder esto');
    expect(
      screen.queryByText('Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?'),
    ).not.toBeInTheDocument();
  });

  it('si el guardado falla, "Guardar y salir" no cierra el aviso ni cambia de pestaña, y deja el error visible', async () => {
    planTratamientoService.guardar.mockRejectedValue(new Error('el servidor rechazó el guardado'));
    render(<Harness />);
    const observaciones = await marcarComoSucio('Esto no se debe perder si falla el guardado');

    fireEvent.click(screen.getByText('Ir a otra pestaña'));
    fireEvent.click(screen.getByRole('button', { name: /guardar y salir/i }));

    await waitFor(() => expect(planTratamientoService.guardar).toHaveBeenCalledTimes(1));

    // Sigue en "plan", con el mismo aviso todavía abierto (no se cerró solo porque falló).
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('plan');
    expect(
      screen.getByText('Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?'),
    ).toBeInTheDocument();
    // Lo que escribió no se pierde.
    expect(observaciones).toHaveValue('Esto no se debe perder si falla el guardado');
    // El error del guardado queda visible para que sepa qué pasó.
    expect(
      screen.getByText('No se pudo guardar el plan de tratamiento. Intenta de nuevo.'),
    ).toBeInTheDocument();
  });

  it('SCRUM-287: sin cambios pendientes, cambiar de pestaña no muestra ningún aviso', async () => {
    render(<Harness />);
    await esperarCarga();

    fireEvent.click(screen.getByText('Ir a otra pestaña'));

    expect(
      screen.queryByText('Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('otra');
  });

  it('SCRUM-286: el listener de beforeunload se registra solo mientras hay cambios sin guardar', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    planTratamientoService.guardar.mockResolvedValue(planVacio);

    render(<Harness />);
    await esperarCarga();
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    await marcarComoSucio();
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios del plan/i }));
    await waitFor(() => expect(planTratamientoService.guardar).toHaveBeenCalledTimes(1));

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});

// Subtarea de Rodrigo dentro de SCRUM-283: una pieza con tratamiento puede
// guardarse sin valor (queda en 0, "Pendiente de precio") en vez de bloquear
// el guardado como antes.
describe('PlanTratamientoTab - guardar tratamiento sin valor (subtarea de Rodrigo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const filaDe = (etiqueta) => screen.getByText(etiqueta, { selector: 'td.plan-pieza' }).closest('tr');

  it('una pieza guardada con tratamiento y valor 0 se muestra como "Pendiente de precio"', async () => {
    planTratamientoService.getByPaciente.mockResolvedValue({
      piezas: [{ pieza: '16', tratamiento: 'Limpieza', valor: 0, estado: 'Pendiente' }],
      descuento: 0,
      observacionesGenerales: '',
      fechaInicio: '2026-01-10',
    });
    render(<Harness />);
    await esperarCarga();

    expect(within(filaDe('16')).getByText('Pendiente de precio')).toBeInTheDocument();
  });

  it('guardar un tratamiento sin valor ya no se bloquea: se guarda con valor 0', async () => {
    planTratamientoService.getByPaciente.mockResolvedValue(planVacio);
    planTratamientoService.guardar.mockResolvedValue({
      piezas: [{ pieza: '16', tratamiento: 'Limpieza', valor: 0, estado: 'Pendiente' }],
      descuento: 0,
      observacionesGenerales: '',
      fechaInicio: '2026-01-10',
    });
    render(<Harness />);
    await esperarCarga();

    const tratamiento = within(filaDe('16')).getByPlaceholderText('Tratamiento');
    fireEvent.change(tratamiento, { target: { value: 'Limpieza' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios del plan/i }));

    await waitFor(() => expect(planTratamientoService.guardar).toHaveBeenCalledTimes(1));
    expect(planTratamientoService.guardar).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        piezas: expect.arrayContaining([
          expect.objectContaining({ pieza: '16', tratamiento: 'Limpieza', valor: 0 }),
        ]),
      }),
    );
    // Ya no bloquea con el error de "tiene un tratamiento pero no tiene un valor".
    expect(screen.queryByText(/tiene un tratamiento pero no tiene un valor/i)).not.toBeInTheDocument();
    // Y la fila queda marcada como pendiente de precio en vez de "Q0".
    expect(within(filaDe('16')).getByText('Pendiente de precio')).toBeInTheDocument();
  });
});
