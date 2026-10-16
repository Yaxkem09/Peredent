import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VistaMes from './VistaMes';

// El día marcado en la vista mes se avisa a Calendario para que "+ Nueva cita"
// abra con esa fecha en lugar de la de hoy.
describe('VistaMes - día marcado', () => {
  const renderMes = (onSeleccionarDia) =>
    render(
      <VistaMes
        fechaActual={new Date(2026, 9, 15)}
        citas={[]}
        bloqueos={[]}
        esOdontologo
        onSeleccionarCita={vi.fn()}
        onVerMas={vi.fn()}
        onMarcarBloqueo={vi.fn()}
        onQuitarBloqueo={vi.fn()}
        onSeleccionarDia={onSeleccionarDia}
      />,
    );

  const celdaDelDia = (container, dia) =>
    [...container.querySelectorAll('.month-cell:not(.outside)')].find(
      (celda) => celda.querySelector('.month-daynum')?.textContent === String(dia),
    );

  it('avisa el día al hacer clic en una celda', () => {
    const onSeleccionarDia = vi.fn();
    const { container } = renderMes(onSeleccionarDia);

    fireEvent.click(celdaDelDia(container, 23));

    expect(onSeleccionarDia).toHaveBeenLastCalledWith('2026-10-23');
  });

  it('también avisa el día marcado al mostrarse el mes', () => {
    const onSeleccionarDia = vi.fn();
    renderMes(onSeleccionarDia);

    expect(onSeleccionarDia).toHaveBeenCalled();
    expect(onSeleccionarDia.mock.lastCall[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
