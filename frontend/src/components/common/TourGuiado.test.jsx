import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TourGuiado from './TourGuiado';

const PASOS = [
  { selector: '#uno', titulo: 'Paso uno', texto: 'Primer elemento.' },
  { selector: '#no-existe', titulo: 'Paso fantasma', texto: 'No está en pantalla.' },
  { selector: '#dos', titulo: 'Paso dos', texto: 'Segundo elemento.' },
];

const renderTour = (onCerrar = vi.fn()) => {
  render(
    <>
      <div id="uno">Uno</div>
      <div id="dos">Dos</div>
      <TourGuiado pasos={PASOS} abierto onCerrar={onCerrar} />
    </>,
  );
  return onCerrar;
};

describe('TourGuiado', () => {
  it('recorre solo los pasos cuyo elemento está en pantalla', () => {
    renderTour();

    expect(screen.getByRole('dialog')).toHaveTextContent('Paso uno');
    expect(screen.getByText('1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Paso dos');
    expect(screen.queryByText('Paso fantasma')).not.toBeInTheDocument();
  });

  it('"Anterior" regresa y en el último paso el botón es "Cerrar"', () => {
    const onCerrar = renderTour();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Paso uno');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('Esc cierra y las flechas del teclado navegan', () => {
    const onCerrar = renderTour();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog')).toHaveTextContent('Paso dos');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog')).toHaveTextContent('Paso uno');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalled();
  });

  it('si ningún elemento está en pantalla, se cierra sin mostrar nada', () => {
    const onCerrar = vi.fn();
    render(<TourGuiado pasos={[PASOS[1]]} abierto onCerrar={onCerrar} />);

    expect(onCerrar).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
