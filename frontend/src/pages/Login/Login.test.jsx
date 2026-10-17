import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import Login from './Login';
import { AuthContext } from '../../context/AuthContext';

const renderLogin = (login = vi.fn().mockResolvedValue({})) => {
  const router = createMemoryRouter([
    { path: '/login', element: <Login /> },
    { path: '/pacientes', element: <div>Pacientes</div> },
  ], { initialEntries: ['/login'] });
  render(
    <AuthContext.Provider value={{ login }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return login;
};

const llenar = (correo, clave = 'Clave1234') => {
  // La pantalla también tiene el formulario de recuperación con su propio campo
  // "Correo electrónico"; el del login es #correo.
  fireEvent.change(document.getElementById('correo'), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: clave } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('Login - solo con correo', () => {
  it('con un nombre de usuario (sin formato de correo) no intenta entrar y lo indica', () => {
    const login = renderLogin();

    llenar('dra.solis');

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText(/inicia sesión con tu correo electrónico/i)).toBeInTheDocument();
  });

  it('con un correo válido manda el correo sin espacios y entra', async () => {
    const login = renderLogin();

    llenar('  dra.solis@peredent.com ');

    await waitFor(() => expect(login).toHaveBeenCalledWith({ correo: 'dra.solis@peredent.com', clave: 'Clave1234' }));
    expect(await screen.findByText('Pacientes')).toBeInTheDocument();
  });
});
