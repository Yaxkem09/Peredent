import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Estos archivos son placeholders de texto (no código real), heredados
      // del repo; Vitest los tomaría como specs rotos si no se excluyen.
      'src/__tests__/setup.js',
      'src/__tests__/hooks/useAuth.test.js',
      'src/__tests__/services/auth.service.test.js',
    ],
  },
});
