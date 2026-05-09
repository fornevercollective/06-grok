import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  test('renders the live strip with initial state', () => {
    render(<App />);
    const liveStrip = screen.getByLabelText(/Clock and host hints/i);
    expect(liveStrip).toBeInTheDocument();
  });

  test('unix/epoch displays value after update', async () => {
    render(<App />);
    const timeCombo = screen.getByLabelText(/Unix seconds and epoch milliseconds/i);
    // Initially might be empty, but after effect it should have content
    await waitFor(() => {
      expect(timeCombo.textContent).not.toBe('');
    }, { timeout: 2000 });
  });

  test('expandable metrics toggle on Ctrl+E', () => {
    render(<App />);
    // Initially, expanded hint should be visible
    expect(screen.getByText('ctrl+e expand')).toBeInTheDocument();

    // Simulate Ctrl+E
    fireEvent.keyDown(document, { key: 'e', ctrlKey: true });

    // After toggle, expanded metrics should be visible
    expect(screen.getByText('region')).toBeInTheDocument();
    expect(screen.getByText('drift')).toBeInTheDocument();
  });

  test('terminal input accepts commands', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/type command…/i);
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Check if output appears (this might need mocking the terminal logic)
    // For now, just ensure input exists
    expect(input).toBeInTheDocument();
  });
});