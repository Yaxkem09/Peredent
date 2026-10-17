import { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Link, RouterProvider, createMemoryRouter } from 'react-router-dom';
import EndodonciaTab from './EndodonciaTab';
import { endodonciaService } from '../../services/endodoncia.service';
import { protesisService } from '../../services/protesis.service';

vi.mock('../../services/endodoncia.service', () => ({
  endodonciaService: { getByPaciente: vi.fn(), guardar: vi.fn() },
}));
vi.mock('../../services/protesis.service', () => ({
  protesisService: { getByPaciente: vi.fn(), guardar: vi.fn() },
}));

const endodonciaVacia = { piezas: [], txPeriodontal: false, observacionesTxPeriodontal: null, observacionesEndodoncia: null };
const protesisVacia = { ppf: false, pprSup: false, pprInf: false, ptSup: false, ptInf: false, observacionesProtesis: null };

const TEXTO_AVISO = 'Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?';

// Mismo contrato que PacienteDetail: ref con intentarCambiarTab y un callback
// que sí cambia la pestaña.
const Harness = () => {
  const ref = useRef(null);
  const [tab, setTab] = useState('endodoncia');

  return (
    <>
      <button type="button" onClick={() => ref.current?.intentarCambiarTab('otra')}>
        Ir a otra pestaña
      </button>
      <Link to="/otra-pantalla">Ir a otra pantalla</Link>
      <div data-testid="tab-actual">{tab}</div>
      {tab === 'endodoncia' && <EndodonciaTab idPaciente={1} ref={ref} onCambiarTab={setTab} />}
    </>
  );
};

const renderHarness = () => {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Harness /> },
      { path: '/otra-pantalla', element: <div>Otra pantalla</div> },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
};

const esperarCarga = () => screen.findByLabelText('Observaciones sobre endodoncia');

describe('EndodonciaTab - aviso de cambios sin guardar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    endodonciaService.getByPaciente.mockResolvedValue(endodonciaVacia);
    protesisService.getByPaciente.mockResolvedValue(protesisVacia);
  });

  it('sin cambios, cambiar de pestaña no muestra aviso', async () => {
    renderHarness();
    await esperarCarga();

    fireEvent.click(screen.getByText('Ir a otra pestaña'));

    expect(screen.queryByText(TEXTO_AVISO)).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('otra');
  });

  it('con cambios en endodoncia, cambiar de pestaña muestra el aviso y no cambia', async () => {
    renderHarness();
    fireEvent.change(await esperarCarga(), { target: { value: 'Nota' } });

    fireEvent.click(screen.getByText('Ir a otra pestaña'));

    expect(screen.getByText(TEXTO_AVISO)).toBeInTheDocument();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('endodoncia');
  });

  it('"Guardar y salir" guarda solo el bloque con cambios (prótesis) y luego cambia de pestaña', async () => {
    protesisService.guardar.mockResolvedValue({ ...protesisVacia, observacionesProtesis: 'PPF a futuro' });
    renderHarness();
    await esperarCarga();
    fireEvent.change(screen.getByLabelText('Observaciones de prótesis'), { target: { value: 'PPF a futuro' } });

    fireEvent.click(screen.getByText('Ir a otra pestaña'));
    fireEvent.click(screen.getByRole('button', { name: /guardar y salir/i }));

    await waitFor(() => expect(screen.getByTestId('tab-actual')).toHaveTextContent('otra'));
    expect(protesisService.guardar).toHaveBeenCalledTimes(1);
    expect(endodonciaService.guardar).not.toHaveBeenCalled();
  });

  it('si falla el guardado, no sale y el error queda visible', async () => {
    endodonciaService.guardar.mockRejectedValue(new Error('falló'));
    renderHarness();
    fireEvent.change(await esperarCarga(), { target: { value: 'No se pierde' } });

    fireEvent.click(screen.getByText('Ir a otra pestaña'));
    fireEvent.click(screen.getByRole('button', { name: /guardar y salir/i }));

    await waitFor(() => expect(endodonciaService.guardar).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('endodoncia');
    expect(screen.getByText(TEXTO_AVISO)).toBeInTheDocument();
    expect(screen.getByText('No se pudo guardar. Intenta de nuevo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Observaciones sobre endodoncia')).toHaveValue('No se pierde');
  });

  it('con cambios, salir a otra pantalla muestra el aviso; "Cancelar" se queda sin perder lo escrito', async () => {
    renderHarness();
    fireEvent.change(await esperarCarga(), { target: { value: 'Se queda' } });

    fireEvent.click(screen.getByText('Ir a otra pantalla'));
    fireEvent.click(await screen.findByRole('button', { name: /^cancelar$/i }));

    expect(screen.queryByText('Otra pantalla')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Observaciones sobre endodoncia')).toHaveValue('Se queda');
    expect(endodonciaService.guardar).not.toHaveBeenCalled();
  });

  it('después de guardar con el botón del bloque, ya no hay aviso', async () => {
    endodonciaService.guardar.mockResolvedValue({ ...endodonciaVacia, observacionesEndodoncia: 'Guardada' });
    renderHarness();
    fireEvent.change(await esperarCarga(), { target: { value: 'Guardada' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar registro/i }));
    await screen.findByText('Registro guardado correctamente.');

    fireEvent.click(screen.getByText('Ir a otra pestaña'));

    expect(screen.queryByText(TEXTO_AVISO)).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-actual')).toHaveTextContent('otra');
  });
});
