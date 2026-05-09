import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TerminalPane from './TerminalPane';
import { useAppStore } from '../store';

jest.mock('../store', () => ({
  useAppStore: jest.fn(),
}));

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

describe('TerminalPane', () => {
  const mockAddTerminalHistory = jest.fn();
  const mockTerminalHistory: any[] = [];

  beforeEach(() => {
    mockUseAppStore.mockReturnValue({
      terminalHistory: mockTerminalHistory,
      addTerminalHistory: mockAddTerminalHistory,
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockTerminalHistory.length = 0;
  });

  it('renders terminal input', () => {
    render(<TerminalPane />);
    expect(screen.getByPlaceholderText('type command…')).toBeInTheDocument();
    expect(screen.getByText('grok ❯')).toBeInTheDocument();
  });

  it('handles help command', async () => {
    render(<TerminalPane />);
    const input = screen.getByPlaceholderText('type command…');
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(mockAddTerminalHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'help',
          output: expect.stringContaining('Available commands'),
        })
      );
    });
  });

  it('handles ask command', async () => {
    render(<TerminalPane />);
    const input = screen.getByPlaceholderText('type command…');
    fireEvent.change(input, { target: { value: 'ask What is AI?' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(mockAddTerminalHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'ask What is AI?',
          output: expect.stringContaining('Grok AI Response'),
        })
      );
    });
  });

  it('handles unknown command', async () => {
    render(<TerminalPane />);
    const input = screen.getByPlaceholderText('type command…');
    fireEvent.change(input, { target: { value: 'unknown' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(mockAddTerminalHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'unknown',
          output: expect.stringContaining('Unknown command'),
        })
      );
    });
  });

  it('clears input after submit', async () => {
    render(<TerminalPane />);
    const input = screen.getByPlaceholderText('type command…');
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('displays terminal history', () => {
    const historyItem = {
      command: 'test',
      output: 'output',
      timestamp: Date.now(),
    };
    mockTerminalHistory.push(historyItem);

    render(<TerminalPane />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('output')).toBeInTheDocument();
  });
});