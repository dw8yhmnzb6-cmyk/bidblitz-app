/**
 * BidBlitz Match-3 Puzzle Game
 * Candy Crush style match-3 game to earn coins
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Coins, Trophy, RotateCcw, Sparkles } from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const GRID_SIZE = 8;
const COLORS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠'];

// Generate random grid
const generateGrid = () => {
  const grid = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const row = [];
    for (let j = 0; j < GRID_SIZE; j++) {
      row.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    grid.push(row);
  }
  return grid;
};

// Check for matches
const findMatches = (grid) => {
  const matches = new Set();
  
  // Horizontal matches
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE - 2; j++) {
      if (grid[i][j] && grid[i][j] === grid[i][j+1] && grid[i][j] === grid[i][j+2]) {
        matches.add(`${i},${j}`);
        matches.add(`${i},${j+1}`);
        matches.add(`${i},${j+2}`);
      }
    }
  }
  
  // Vertical matches
  for (let i = 0; i < GRID_SIZE - 2; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (grid[i][j] && grid[i][j] === grid[i+1][j] && grid[i][j] === grid[i+2][j]) {
        matches.add(`${i},${j}`);
        matches.add(`${i+1},${j}`);
        matches.add(`${i+2},${j}`);
      }
    }
  }
  
  return matches;
};

// Swap two cells
const swapCells = (grid, r1, c1, r2, c2) => {
  const newGrid = grid.map(row => [...row]);
  const temp = newGrid[r1][c1];
  newGrid[r1][c1] = newGrid[r2][c2];
  newGrid[r2][c2] = temp;
  return newGrid;
};

// Remove matches and drop cells
const processMatches = (grid, matches) => {
  const newGrid = grid.map(row => [...row]);
  
  // Remove matched cells
  matches.forEach(pos => {
    const [r, c] = pos.split(',').map(Number);
    newGrid[r][c] = null;
  });
  
  // Drop cells down
  for (let c = 0; c < GRID_SIZE; c++) {
    let emptyRow = GRID_SIZE - 1;
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      if (newGrid[r][c] !== null) {
        if (r !== emptyRow) {
          newGrid[emptyRow][c] = newGrid[r][c];
          newGrid[r][c] = null;
        }
        emptyRow--;
      }
    }
    // Fill empty spots
    for (let r = emptyRow; r >= 0; r--) {
      newGrid[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
  }
  
  return newGrid;
};

export default function Match3Game() {
  const [grid, setGrid] = useState(generateGrid);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(20);
  const [balance, setBalance] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchBalance();
  }, []);
  
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setBalance(res.data.coins || 0);
    } catch (error) {
      console.log('Balance not available');
    }
  };
  
  // Process matches after grid change
  useEffect(() => {
    const matches = findMatches(grid);
    if (matches.size > 0) {
      setTimeout(() => {
        const points = matches.size * 10 * (combo + 1);
        setScore(s => s + points);
        setCombo(c => c + 1);
        setGrid(processMatches(grid, matches));
      }, 300);
    } else {
      setCombo(0);
    }
  }, [grid]);
  
  // Check game over
  useEffect(() => {
    if (moves <= 0 && !gameOver) {
      setGameOver(true);
      saveScore();
    }
  }, [moves]);
  
  const saveScore = async () => {
    if (score > 0) {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const coins = Math.floor(score / 10);
        
        const res = await axios.post(`${API}/app/games/play`, 
          { game_type: 'match3', score },
          { headers }
        );
        
        setMessage(`Spiel beendet! +${res.data.reward} Coins`);
        setBalance(res.data.new_balance);
      } catch (error) {
        console.log('Error saving score');
      }
    }
  };
  
  const handleCellClick = (row, col) => {
    if (gameOver || moves <= 0) return;
    
    if (!selected) {
      setSelected({ row, col });
    } else {
      // Check if adjacent
      const dr = Math.abs(row - selected.row);
      const dc = Math.abs(col - selected.col);
      
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        // Swap
        const newGrid = swapCells(grid, selected.row, selected.col, row, col);
        const matches = findMatches(newGrid);
        
        if (matches.size > 0) {
          setGrid(newGrid);
          setMoves(m => m - 1);
        } else {
          // Invalid move - swap back would happen, just deselect
          setMessage('Kein Match möglich!');
          setTimeout(() => setMessage(''), 1000);
        }
      }
      setSelected(null);
    }
  };
  
  const resetGame = () => {
    setGrid(generateGrid());
    setScore(0);
    setMoves(20);
    setGameOver(false);
    setCombo(0);
    setMessage('');
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-24">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Link to="/games" className="p-2 bg-[#1c213f] rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Match-3</h1>
        <div className="flex items-center gap-2 bg-[#1c213f] px-3 py-1.5 rounded-xl">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-bold">{balance}</span>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="px-4 mb-4">
        <div className="flex justify-between bg-[#1c213f] rounded-xl p-3">
          <div className="text-center">
            <p className="text-xs text-slate-400">Score</p>
            <p className="text-lg font-bold text-[#6c63ff]">{score}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Moves</p>
            <p className="text-lg font-bold text-amber-400">{moves}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Combo</p>
            <p className="text-lg font-bold text-green-400">x{combo + 1}</p>
          </div>
        </div>
      </div>
      
      {/* Message */}
      {message && (
        <div className="mx-4 mb-4 p-3 bg-[#6c63ff]/20 rounded-xl text-center text-[#6c63ff] font-medium">
          {message}
        </div>
      )}
      
      {/* Game Grid */}
      <div className="px-4">
        <div className="bg-[#1c213f] rounded-2xl p-3">
          <div 
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
          >
            {grid.map((row, i) =>
              row.map((cell, j) => (
                <button
                  key={`${i}-${j}`}
                  onClick={() => handleCellClick(i, j)}
                  className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all duration-200 ${
                    selected?.row === i && selected?.col === j
                      ? 'bg-[#6c63ff] scale-110 ring-2 ring-white'
                      : 'bg-[#0c0f22] hover:bg-[#252b4d]'
                  }`}
                >
                  {cell}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c213f] rounded-2xl p-6 max-w-sm w-full text-center">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Spiel beendet!</h2>
            <p className="text-4xl font-bold text-[#6c63ff] mb-2">{score}</p>
            <p className="text-slate-400 mb-6">Punkte</p>
            
            {message && (
              <p className="text-green-400 font-semibold mb-4">{message}</p>
            )}
            
            <div className="flex gap-3">
              <Link
                to="/games"
                className="flex-1 py-3 bg-slate-700 rounded-xl font-semibold"
              >
                Zurück
              </Link>
              <button
                onClick={resetGame}
                className="flex-1 py-3 bg-[#6c63ff] rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Nochmal
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Reset Button */}
      <div className="px-4 mt-4">
        <button
          onClick={resetGame}
          className="w-full py-3 bg-[#1c213f] hover:bg-[#252b4d] rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Neues Spiel
        </button>
      </div>
      
      <BottomNav />
    </div>
  );
}
