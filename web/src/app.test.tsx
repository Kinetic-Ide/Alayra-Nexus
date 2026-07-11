import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { App } from './app';

describe('App', () => {
  it('mounts the shell and lands on Overview', () => {
    render(<App />);
    // Shell chrome
    expect(screen.getByText('Alayra Nexus')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    // Overview landing content (subtitle is unique to the page, not the nav)
    expect(screen.getByText('Real-time gateway telemetry')).toBeInTheDocument();
  });
});
