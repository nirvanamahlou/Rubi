import { vi } from 'vitest';

// Component tests render isolated English subtrees without the application provider.
vi.mock(import('./translate'), async (original) => {
  const translation = await original();
  await translation.loadEnglishUiCatalog();
  return translation;
});
