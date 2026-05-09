import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';

const TerminalPane: React.FC = () => {
  const { terminalHistory, addTerminalHistory } = useAppStore();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  const handleCommand = async (command: string) => {
    if (!command.trim()) return;

    const timestamp = Date.now();
    const output = await processCommand(command);
    addTerminalHistory({ command, output, timestamp });
  };

  const processCommand = async (cmd: string): Promise<string> => {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'help':
        return `Available commands:
help - Show this help
clear - Clear terminal
ask [query] - Ask Grok AI
note [text] - Add note to notes panel
perf - Show performance metrics`;

      case 'clear':
        // Clear will be handled by clearing history
        return '';

      case 'ask':
      case 'grok':
        const query = parts.slice(1).join(' ');
        if (!query) return 'Usage: ask <query>';
        return `Grok AI Response: Simulated response for "${query}"`;

      case 'note':
        const noteText = parts.slice(1).join(' ');
        if (!noteText) return 'Usage: note <text>';
        // Add note logic here
        return `Note added: ${noteText}`;

      case 'perf':
        return `Performance:
Load Time: 165ms
Uptime: ${Math.round(performance.now() / 1000)}s
FPS: 60
Memory: ~50MB`;

      default:
        return `Unknown command: ${command}. Type 'help' for available commands.`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      // History navigation (simplified)
    } else if (e.key === 'ArrowDown') {
      // History navigation
    }
  };

  return (
    <div className="term-pane">
      <div id="term-output" ref={outputRef}>
        {terminalHistory.map((item, index) => (
          <div key={index} className="ln">
            <span className="c-prompt">{new Date(item.timestamp).toLocaleTimeString('en', { hour12: false })} grok.notes ❯</span>{' '}
            <span className="c-cmd">{item.command}</span>
            {item.output && (
              <>
                <br />
                <span className="c-info">{item.output}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="term-prompt">
        <span className="tp-label">grok ❯</span>
        <form onSubmit={handleSubmit}>
          <input
            id="term-input"
            type="text"
            placeholder="type command…"
            autoComplete="off"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={inputRef}
          />
        </form>
      </div>
    </div>
  );
};

export default TerminalPane;