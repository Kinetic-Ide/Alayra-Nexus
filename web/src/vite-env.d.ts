/// <reference types="vite/client" />

// Self-hosted fonts are imported for their side effects (they inject @font-face); they ship no
// type declarations, so declare them as bare modules.
declare module '@fontsource-variable/inter';
declare module '@fontsource-variable/jetbrains-mono';
