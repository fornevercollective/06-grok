import React, { useState } from 'react';

const NeuralinkGrid: React.FC = () => {
  const [grid, setGrid] = useState(Array(10).fill(null).map(() => Array(10).fill(false)));
  const [isConnected, setIsConnected] = useState(false);

  const handleCellClick = (row: number, col: number) => {
    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = !newGrid[row][col];
    setGrid(newGrid);
  };

  const connectNeuralink = () => {
    setIsConnected(!isConnected);
    alert(isConnected ? 'Disconnected from Neuralink' : 'Connected to Neuralink (simulated)');
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2>Neuralink Web Grid</h2>
      <p>Neural interface grid simulation. Click cells to activate neural links.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 30px)', gap: '2px', margin: 'auto', marginBottom: '20px' }}>
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              style={{
                width: '30px',
                height: '30px',
                background: cell ? '#00ff00' : '#333',
                border: '1px solid #666',
                cursor: 'pointer'
              }}
            />
          ))
        )}
      </div>
      <div>
        <button onClick={connectNeuralink}>
          {isConnected ? 'Disconnect' : 'Connect'} Neuralink
        </button>
        <button onClick={() => alert('Training neural network (placeholder)')}>
          Train Neural Net
        </button>
      </div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
};

export default NeuralinkGrid;