/**
 * BidBlitz Treasure Hunt (Schatzsuche)
 * Find the treasure in a grid to win coins
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const GRID_SIZE = 5;
const MAX_ATTEMPTS = 8;

export default function TreasureHunt() {
  const [grid, setGrid] = useState([]);
  const [treasurePos, setTreasurePos] = useState(null);
  const [attempts, setAttempts] = useState(MAX_ATTEMPTS);
  const [found, setFound] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [prize, setPrize] = useState(0);
  const [message, setMessage] = useState('');
  const [coins, setCoins] = useState(0);
  
  useEffect(() => {
    fetchCoins();
    startGame();
  }, []);
  
  const fetchCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 0);
    } catch (error) {
      console.log('Coins error');
    }
  };
  
  const startGame = () => {
    // Create empty grid
    const newGrid = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      newGrid.push({ revealed: false, isTreasure: false, distance: 0 });
    }
    
    // Place treasure randomly
    const treasureIndex = Math.floor(Math.random() * GRID_SIZE * GRID_SIZE);
    newGrid[treasureIndex].isTreasure = true;
    
    // Calculate distances
    const treasureRow = Math.floor(treasureIndex / GRID_SIZE);
    const treasureCol = treasureIndex % GRID_SIZE;
    
    for (let i = 0; i < newGrid.length; i++) {
      const row = Math.floor(i / GRID_SIZE);
      const col = i % GRID_SIZE;
      const distance = Math.abs(row - treasureRow) + Math.abs(col - treasureCol);
      newGrid[i].distance = distance;
    }
    
    setGrid(newGrid);
    setTreasurePos(treasureIndex);
    setAttempts(MAX_ATTEMPTS);
    setFound(false);
    setGameOver(false);
    setPrize(0);
    setMessage('');
  };
  
  const handleCellClick = async (index) => {
    if (gameOver || grid[index].revealed) return;
    
    const newGrid = [...grid];
    newGrid[index].revealed = true;
    setGrid(newGrid);
    
    if (newGrid[index].isTreasure) {
      // Found treasure!
      const reward = (attempts + 1) * 25; // More attempts left = more reward
      setPrize(reward);
      setFound(true);
      setGameOver(true);
      setMessage(`🎉 Schatz gefunden! +${reward} Coins!`);
      
      // Save to backend
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.post(`${API}/app/games/play`, 
          { game_type: 'treasure_hunt', score: reward },
          { headers }
        );
        setCoins(res.data.new_balance);
      } catch (error) {
        console.log('Save error');
      }
    } else {
      // Not treasure
      const remaining = attempts - 1;
      setAttempts(remaining);
      
      if (remaining <= 0) {
        setGameOver(true);
        setMessage('❌ Keine Versuche mehr! Der Schatz war hier: 💎');
        // Reveal treasure
        newGrid[treasurePos].revealed = true;
        setGrid([...newGrid]);
      } else {
        // Show hint
        const distance = newGrid[index].distance;
        if (distance <= 1) {
          setMessage('🔥 Sehr heiß! Ganz nah dran!');
        } else if (distance <= 2) {
          setMessage('🌡️ Warm! Du kommst näher!');
        } else if (distance <= 3) {
          setMessage('❄️ Kalt. Versuch woanders.');
        } else {
          setMessage('🥶 Eiskalt! Weit weg.');
        }
      }
    }
  };
  
  const getCellColor = (cell) => {
    if (!cell.revealed) return 'bg-[#1c213f] hover:bg-[#252b4d]';
    if (cell.isTreasure) return 'bg-amber-500';
    if (cell.distance <= 1) return 'bg-red-500/50';
    if (cell.distance <= 2) return 'bg-orange-500/50';
    if (cell.distance <= 3) return 'bg-blue-500/50';
    return 'bg-slate-700/50';
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">🗺️ Schatzsuche</h2>
        <p className="text-slate-400 mb-4">Coins: <span className="text-amber-400 font-bold">{coins.toLocaleString()}</span></p>
        
        {/* Stats */}
        <div className="flex gap-4 mb-4">
          <div className="bg-[#1c213f] px-4 py-2 rounded-lg">
            <span className="text-slate-400 text-sm">Versuche</span>
            <p className={`font-bold text-lg ${attempts <= 2 ? 'text-red-400' : 'text-green-400'}`}>
              {attempts}/{MAX_ATTEMPTS}
            </p>
          </div>
          {prize > 0 && (
            <div className="bg-amber-500/20 px-4 py-2 rounded-lg">
              <span className="text-amber-400 text-sm">Gewinn</span>
              <p className="font-bold text-lg text-amber-400">+{prize}</p>
            </div>
          )}
        </div>
        
        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-center font-medium ${
            found ? 'bg-green-500/20 text-green-400' : 
            gameOver ? 'bg-red-500/20 text-red-400' :
            'bg-[#1c213f] text-white'
          }`}>
            {message}
          </div>
        )}
        
        {/* Grid */}
        <div 
          className="mx-auto mb-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gap: '8px',
            maxWidth: '300px'
          }}
        >
          {grid.map((cell, index) => (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={gameOver || cell.revealed}
              className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${getCellColor(cell)} ${
                !cell.revealed && !gameOver ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {cell.revealed && cell.isTreasure ? '💎' : cell.revealed ? '❌' : '?'}
            </button>
          ))}
        </div>
        
        {/* Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={startGame}
            className="px-6 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg font-medium"
          >
            Neues Spiel
          </button>
          <Link
            to="/games"
            className="px-6 py-2.5 bg-[#1c213f] hover:bg-[#252b4d] rounded-lg font-medium"
          >
            Zurück
          </Link>
        </div>
        
        {/* Instructions */}
        <div className="mt-6 bg-[#1c213f] rounded-xl p-4 text-sm text-slate-400">
          <h4 className="font-semibold text-white mb-2">Anleitung</h4>
          <p>• Finde den Schatz in {MAX_ATTEMPTS} Versuchen</p>
          <p>• 🔥 Heiß = nah dran, ❄️ Kalt = weit weg</p>
          <p>• Je mehr Versuche übrig, desto mehr Coins!</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
