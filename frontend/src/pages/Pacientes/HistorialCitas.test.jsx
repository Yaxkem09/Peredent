import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import HistorialCitas from './HistorialCitas';
import { citasService } from '../../services/citas.service';
import { usuariosService } from '../../services/usuarios.service';

vi.mock('../../services/citas.service', () => ({
  citasService: { getByPaciente: vi.fn(), getEstados: vi.fn() },
}));
vi.mock('../../services/usuarios.service', () => ({
  usuariosService: { getAll: vi.fn() },
}));

const cita = (idCita, idUsuario, nombreOdontologo, fecha) => ({
  idCita,
  idPaciente: 1,
  idUsuario,
  nombreOdontologo,
  fecha,
  hora: '09:00:00',
  duracionMinutos: 30,
  estado: 'Pendiente',
  notasAdicionales: null,
});

const renderHistorial = () => {
  const router = createMemoryRouter([{ path: '/', element: <HistorialCitas idPaciente={1} /> }]);
  return render(<RouterProvider router={router} />);
};

describe('HistorialCitas - filtro por odontólogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    citasService.getEstados.mockResolvedValue([]);
    citasService.getByPaciente.mockResolvedValue([
      cita(1, 10, 'Emilio', '2026-10-15'),
      cita(2, 20, 'admin', '2026-10-14'),
    ]);
    usuariosService.getAll.mockResolvedValue([
      { id: 10, nombreUsuario: 'Emilio', rol: 'Odontologo' },
      { id: 30, nombreUsuario: 'Asistente', rol: 'Asistente' },
    ]);
  });

  it('las opciones son los odontólogos y quien aparezca en las citas, sin asistentes', async () => {
    renderHistorial();
    const select = await screen.findByLabelText('Odontólogo');
    await screen.findByRole('table');

    const opciones = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Todos', 'admin', 'Emilio']);
  });

  it('al elegir un odontólogo solo quedan sus citas', async () => {
    renderHistorial();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Odontólogo'), { target: { value: '10' } });

    const tabla = screen.getByRole('table');
    expect(within(tabla).getByText('Emilio')).toBeInTheDocument();
    expect(within(tabla).queryByText('admin')).not.toBeInTheDocument();
    expect(screen.getByText('1 cita')).toBeInTheDocument();
  });
});
