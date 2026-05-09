import React, { useEffect } from 'react';
import { useAppStore } from '../store';

const VoiceCommand: React.FC = () => {
  const { addNotebookCell, toggleTerminal } = useAppStore();

  useEffect(() => {
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (command.includes('add code cell')) {
        addNotebookCell({ id: `cell-${Date.now()}`, type: 'code', content: '' });
      } else if (command.includes('add markdown cell')) {
        addNotebookCell({ id: `cell-${Date.now()}`, type: 'markdown', content: '' });
      } else if (command.includes('toggle terminal')) {
        toggleTerminal();
      }
      // Add more commands
    };

    recognition.start();

    return () => recognition.stop();
  }, [addNotebookCell, toggleTerminal]);

  return <div>Voice Commands Active</div>;
};

export default VoiceCommand;