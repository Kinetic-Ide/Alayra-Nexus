import { render } from 'preact';
// Self-hosted variable fonts (bundled via @fontsource — no CDN, works air-gapped).
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app';

const root = document.getElementById('app');
if (root) render(<App />, root);
