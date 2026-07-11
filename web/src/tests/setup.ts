import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// Tear down the rendered tree after each test so queries never see a previous test's DOM.
afterEach(() => cleanup());
