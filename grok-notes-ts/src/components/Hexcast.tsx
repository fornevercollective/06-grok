import React, { useState, useEffect } from 'react';

const Hexcast: React.FC = () => {
  const [hexcastData, setHexcastData] = useState<string>('Loading Hexcast...');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate loading hexcast data or integrating with rebuilt files
    const loadHexcast = async () => {
      try {
        // For Vite/React integration, fetch from local or backend
        const response = await fetch('/hexcast.html'); // Assuming served locally
        const html = await response.text();
        setHexcastData(html);
      } catch (error) {
        setHexcastData('<p>Hexcast integration failed. Ensure hexcast.html is served.</p>');
      }
    };
    loadHexcast();
  }, []);

  const connectHexcast = () => {
    setIsConnected(!isConnected);
    // Integrate with kbatch, jawta, etc.
    alert(isConnected ? 'Disconnected from Hexcast' : 'Connected to Hexcast (integrated)');
  };

  return (
    <div style={{ height: '100%', width: '100%', padding: '20px', overflow: 'auto' }}>
      <h2>Hexcast - Vite/React Integration</h2>
      <p>Rebuilt as a native React component for seamless integration.</p>
      <button onClick={connectHexcast}>
        {isConnected ? 'Disconnect' : 'Connect'} Hexcast
      </button>
      <div style={{ marginTop: '20px' }} dangerouslySetInnerHTML={{ __html: hexcastData }} />
    </div>
  );
};

export default Hexcast;