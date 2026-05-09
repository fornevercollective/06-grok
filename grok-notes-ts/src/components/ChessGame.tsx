import React, { useState } from 'react';

// Simple chess board representation
const initialBoard = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

const ChessGame: React.FC = () => {
  const [board, setBoard] = useState(initialBoard);
  const [currentPlayer, setCurrentPlayer] = useState('white');

  const pieceSymbols: { [key: string]: string } = {
    r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟',
    R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙'
  };

  const handleCellClick = (row: number, col: number) => {
    // Placeholder: just move piece if empty
    if (board[row][col]) return;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer === 'white' ? 'P' : 'p';
    setBoard(newBoard);
    setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2>Chess Game</h2>
      <p>Current player: {currentPlayer}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 40px)', gap: '1px', margin: 'auto' }}>
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              style={{
                width: '40px',
                height: '40px',
                background: (rowIndex + colIndex) % 2 === 0 ? '#f0d9b5' : '#b58863',
                border: '1px solid black',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}
            >
              {piece && pieceSymbols[piece]}
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => alert('Playing against AI (placeholder)')}>Play vs AI</button>
        <button onClick={() => alert('Training Chess AI (placeholder)')}>Train AI</button>
      </div>
    </div>
  );
};

export default ChessGame;