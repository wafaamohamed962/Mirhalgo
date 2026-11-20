import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../src/i18n';

// Deterministic language for assertions; tests that check RTL switch explicitly.
await i18n.changeLanguage('en');

afterEach(() => cleanup());
