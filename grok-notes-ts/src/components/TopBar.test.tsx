import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../store';
import TopBar from './TopBar';

describe('TopBar', () => {
  it('renders the logo button', () => {
    render(<TopBar />);
    expect(screen.getByText(/\.grok/i)).toBeInTheDocument();
  });

  it('toggles terminal on button click', () => {
    render(<TopBar />);
    const button = screen.getByLabelText(/toggle terminal/i);
    const initial = useAppStore.getState().showTerminal;
    fireEvent.click(button);
    expect(useAppStore.getState().showTerminal).toBe(!initial);
  });

  it('toggles pad on button click', () => {
    useAppStore.getState().addNotebookCell({
      id: 'topbar-pad-test',
      type: 'markdown',
      content: 'x',
    });
    render(<TopBar />);
    const button = screen.getByLabelText(/hide notebook pad/i);
    const initial = useAppStore.getState().showPad;
    fireEvent.click(button);
    expect(useAppStore.getState().showPad).toBe(!initial);
  });

  it('toggles notes on button click', () => {
    render(<TopBar />);
    const button = screen.getByLabelText(/toggle notes panel/i);
    const initial = useAppStore.getState().showNotes;
    fireEvent.click(button);
    expect(useAppStore.getState().showNotes).toBe(!initial);
  });

  it('toggles draw on button click', () => {
    render(<TopBar />);
    const button = screen.getByLabelText(/toggle drawing tools/i);
    const initial = useAppStore.getState().showDraw;
    fireEvent.click(button);
    expect(useAppStore.getState().showDraw).toBe(!initial);
  });
});