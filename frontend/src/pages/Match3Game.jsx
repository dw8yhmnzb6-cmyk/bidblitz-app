/**
 * BidBlitz Match Game - Simple Colorful Grid
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
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      newBoard.push({
        id: i,
        color: color.name,
        bg: color.bg,
        visible: true
      });
    }
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
    setMessage('');
  };
  
  const handleTileClick = (index) => {
    if (!board[index].visible || gameOver) return;
    
    const clickedColor = board[index].color;
    
    // Find all connected tiles of same color
    const toRemove = findConnected(index, clickedColor);
    
    if (toRemove.size >= 3) {
      // Remove tiles and add score
      const newBoard = [...board];
      toRemove.forEach(idx => {
        newBoard[idx] = { ...newBoard[idx], visible: false };
      });
      
      const points = toRemove.size * 10;
      setScore(prev => prev + points);
      setBoard(newBoard);
      
      // Check if game over (no more moves)
      const remaining = newBoard.filter(t => t.visible);
      if (remaining.length < 3) {
        endGame();
      }
    }
  };
  
  const findConnected = (startIndex, color) => {
    const connected = new Set();
    const queue = [startIndex];
    
    while (queue.length > 0) {
      const idx = queue.shift();
      if (connected.has(idx)) continue;
      if (!board[idx].visible || board[idx].color !== color) continue;
      
      connected.add(idx);
      
      // Check neighbors (up, down, left, right)
      const row = Math.floor(idx / GRID_SIZE);
      const col = idx % GRID_SIZE;
      
      if (row > 0) queue.push(idx - GRID_SIZE); // up
      if (row < GRID_SIZE - 1) queue.push(idx + GRID_SIZE); // down
      if (col > 0) queue.push(idx - 1); // left
      if (col < GRID_SIZE - 1) queue.push(idx + 1); // right
    }
    
    return connected;
  };
  
  const endGame = async () => {
    setGameOver(true);
    
    if (score > 0) {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const coins = Math.floor(score / 10);
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
          className="mx-auto mb-4"
          style={{
            width: `${GRID_SIZE * 55 + (GRID_SIZE - 1) * 5}px`,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 50px)`,
            gap: '5px'
          }}
        >
          {board.map((tile, index) => (
            <div
              key={tile.id}
              onClick={() => handleTileClick(index)}
              className="w-[50px] h-[50px] rounded-lg cursor-pointer transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: tile.visible ? tile.bg : 'transparent',
                opacity: tile.visible ? 1 : 0,
              }}
            />
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
          <p>Tap 3+ connected tiles of the same color to score!</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
