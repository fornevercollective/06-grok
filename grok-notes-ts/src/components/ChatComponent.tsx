import React, { useState } from 'react';
import axios from 'axios';

const ChatComponent: React.FC = () => {
  const [messages, setMessages] = useState<{ user: string; ai: string; mode?: string }[]>([]);
  const [input, setInput] = useState('');
  const [offline, setOffline] = useState(false);
  const [model, setModel] = useState('llama3.2');

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { user: userMessage, ai: 'Thinking...' }]);
    try {
      const response = await axios.post('/api/ai/chat', { message: userMessage, offline, model }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = response.data.response;
        newMessages[newMessages.length - 1].mode = response.data.mode;
        return newMessages;
      });
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = 'Error: Could not get response';
        return newMessages;
      });
    }
  };

  return (
    <div className="chat-component">
      <div className="chat-settings">
        <label>
          <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
          Offline Mode
        </label>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="llama3.2">Llama 3.2</option>
          <option value="llava">Llava (Multimodal)</option>
          <option value="grok">Grok (if available)</option>
        </select>
      </div>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <p><strong>You:</strong> {msg.user}</p>
            <p><strong>Grok ({msg.mode}):</strong> {msg.ai}</p>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Ask Grok for help..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default ChatComponent;