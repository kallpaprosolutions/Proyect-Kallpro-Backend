import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Renderiza un componente que usa react-query y/o enlaces de router.
 *
 * `retry: false` es imprescindible: con los reintentos por defecto, un test que
 * comprueba el estado de error espera varios segundos y acaba dando un falso negativo
 * por tiempo agotado.
 */
export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
    options,
  );
}
