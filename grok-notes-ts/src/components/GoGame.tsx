import React, { useState } from 'react';

const GoGame: React.FC = () => {
  const [board, setBoard] = useState(Array(19).fill(null).map(() => Array(19).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState('black');

  const handleCellClick = (row: number, col: number) => {
    if (board[row][col]) return;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2>Go Game</h2>
      <p>Current player: {currentPlayer}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(19, 20px)', gap: '1px', margin: 'auto' }}>
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              style={{
                width: '20px',
                height: '20px',
                background: 'burlywood',
                border: '1px solid black',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {cell && (
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: cell === 'black' ? 'black' : 'white',
                    border: '1px solid black'
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => alert('Playing against AI (placeholder)')}>Play vs AI</button>
        <button onClick={() => alert('Training Go AI (placeholder)')}>Train AI</button>
      </div>
    </div>
  );
};

export default GoGame;