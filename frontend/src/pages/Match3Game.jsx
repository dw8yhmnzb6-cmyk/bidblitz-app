/**
 * BidBlitz Match Game - With Gravity Drop-Down
 * Tiles fall down when matched
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const COLORS = [
  { name: 'red', bg: '#ff4d4d' },
  { name: 'blue', bg: '#4da6ff' },
  { name: 'green', bg: '#4dff88' },
  { name: 'yellow', bg: '#ffd24d' },
  { name: 'purple', bg: '#b84dff' },
];

const GRID_SIZE = 6;

export default function Match3Game() {
  const [board, setBoard] = useState([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    createBoard();
  }, []);
  
  const createBoard = () => {
    const newBoard = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        rowData.push({
          id: `${row}-${col}`,
          color: color.name,
          bg: color.bg,
          visible: true
        });
      }
      newBoard.push(rowData);
    }
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
    setMessage('');
  };
  
  const handleTileClick = (row, col) => {
    if (!board[row][col].visible || gameOver) return;
    
    const clickedColor = board[row][col].color;
    
    // Find all connected tiles of same color
    const toRemove = findConnected(row, col, clickedColor);
    
    if (toRemove.size >= 3) {
      // Remove tiles
      let newBoard = board.map(r => r.map(t => ({ ...t })));
      toRemove.forEach(pos => {
        const [r, c] = pos.split(',').map(Number);
        newBoard[r][c].visible = false;
      });
      
      // Calculate score
      const points = toRemove.size * 10;
      setScore(prev => prev + points);
      
      // Apply gravity - tiles fall down
      setTimeout(() => {
        newBoard = applyGravity(newBoard);
        setBoard(newBoard);
        
        // Check if game over
        const hasValidMoves = checkValidMoves(newBoard);
        if (!hasValidMoves) {
          endGame();
        }
      }, 200);
      
      setBoard(newBoard);
    }
  };
  
  const findConnected = (startRow, startCol, color) => {
    const connected = new Set();
    const queue = [[startRow, startCol]];
    
    while (queue.length > 0) {
      const [row, col] = queue.shift();
      const key = `${row},${col}`;
      
      if (connected.has(key)) continue;
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) continue;
      if (!board[row][col].visible || board[row][col].color !== color) continue;
      
      connected.add(key);
      
      // Check neighbors
      queue.push([row - 1, col]); // up
      queue.push([row + 1, col]); // down
      queue.push([row, col - 1]); // left
      queue.push([row, col + 1]); // right
    }
    
    return connected;
  };
  
  const applyGravity = (currentBoard) => {
    const newBoard = currentBoard.map(r => r.map(t => ({ ...t })));
    
    // Process each column
    for (let col = 0; col < GRID_SIZE; col++) {
      // Collect visible tiles from bottom to top
      const visibleTiles = [];
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (newBoard[row][col].visible) {
          visibleTiles.push({ ...newBoard[row][col] });
        }
      }
      
      // Fill column from bottom with visible tiles, then new tiles
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        const tileIndex = GRID_SIZE - 1 - row;
        if (tileIndex < visibleTiles.length) {
          // Use existing tile
          newBoard[row][col] = {
            ...visibleTiles[tileIndex],
            id: `${row}-${col}`
          };
        } else {
          // Create new tile
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];
          newBoard[row][col] = {
            id: `${row}-${col}`,
            color: color.name,
            bg: color.bg,
            visible: true
          };
        }
      }
    }
    
    return newBoard;
  };
  
  const checkValidMoves = (currentBoard) => {
    // Check if any 3+ connected tiles exist
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (currentBoard[row][col].visible) {
          const connected = new Set();
          const queue = [[row, col]];
          const color = currentBoard[row][col].color;
          
          while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            
            if (connected.has(key)) continue;
            if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
            if (!currentBoard[r][c].visible || currentBoard[r][c].color !== color) continue;
            
            connected.add(key);
            queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
          }
          
          if (connected.size >= 3) return true;
        }
      }
    }
    return false;
  };
  
  const endGame = async () => {
    setGameOver(true);
    
    if (score > 0) {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const res = await axios.post(`${API}/app/games/play`, 
          { game_type: 'match_game', score },
          { headers }
        );
        
        setMessage(`Game Over! +${res.data.reward} Coins`);
      } catch (error) {
        setMessage('Game Over!');
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5 text-center">
        <h2 className="text-2xl font-bold mb-4">BidBlitz Match Game</h2>
        
        {/* Game Board */}
        <div 
          className="mx-auto mb-4 bg-[#1c213f] p-3 rounded-xl inline-block"
        >
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((tile, colIndex) => (
                <div
                  key={tile.id}
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                  className="w-12 h-12 rounded-lg cursor-pointer transition-all duration-300 hover:scale-105"
                  style={{
                    backgroundColor: tile.visible ? tile.bg : '#0c0f22',
                    opacity: tile.visible ? 1 : 0.3,
                    transform: tile.visible ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        
        {/* Score */}
        <p className="text-xl mb-4">Score: <span className="font-bold text-[#6c63ff]">{score}</span></p>
        
        {/* Message */}
        {message && (
          <p className="text-lg text-green-400 mb-4">{message}</p>
        )}
        
        {/* Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={createBoard}
            className="px-6 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg font-medium"
          >
            New Game
          </button>
          <Link
            to="/games"
            className="px-6 py-2.5 bg-[#1c213f] hover:bg-[#252b4d] rounded-lg font-medium"
          >
            Back
          </Link>
        </div>
        
        {/* Instructions */}
        <div className="mt-6 text-sm text-slate-400">
          <p>Tap 3+ connected tiles to match & drop!</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
