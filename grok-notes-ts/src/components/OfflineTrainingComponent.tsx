import React, { useState } from 'react';
import axios from 'axios';

const OfflineTrainingComponent: React.FC = () => {
  const [modelName, setModelName] = useState('');
  const [baseModel, setBaseModel] = useState('llama3.2');
  const [modelfile, setModelfile] = useState(`FROM llama3.2

# Add training data or parameters here
PARAMETER temperature 0.7
PARAMETER top_p 0.9

SYSTEM "You are a helpful assistant."`);
  const [status, setStatus] = useState('');

  const startTraining = async () => {
    if (!modelName.trim()) return;
    setStatus('Training...');
    try {
      const response = await axios.post('/api/ai/train', { modelName, baseModel, modelfile }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStatus(response.data.message);
    } catch (error) {
      setStatus('Training failed');
    }
  };

  return (
    <div className="training-component">
      <h3>Offline Model Training</h3>
      <input
        type="text"
        placeholder="Model Name"
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
      />
      <select value={baseModel} onChange={(e) => setBaseModel(e.target.value)}>
        <option value="llama3.2">Llama 3.2</option>
        <option value="llama3">Llama 3</option>
      </select>
      <textarea
        value={modelfile}
        onChange={(e) => setModelfile(e.target.value)}
        rows={10}
        placeholder="Modelfile content"
      />
      <button onClick={startTraining}>Start Training</button>
      <p>{status}</p>
    </div>
  );
};

export default OfflineTrainingComponent;