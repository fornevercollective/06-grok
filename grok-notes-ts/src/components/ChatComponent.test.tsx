import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import ChatComponent from './ChatComponent';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatComponent', () => {
  it('sends message and receives response', async () => {
    mockedAxios.post.mockResolvedValue({ data: { response: 'Hello from Grok' } });

    render(<ChatComponent />);

    const input = screen.getByPlaceholderText('Ask Grok for help...');
    const button = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Hello from Grok')).toBeInTheDocument();
    });
  });
});