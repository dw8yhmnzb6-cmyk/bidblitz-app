/**
 * BidBlitz Gaming Platform - Main Hub
 * All games organized by category with dynamic loading
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Game categories with colors
const CATEGORIES = [
  { id: 'puzzle', name: 'Puzzle', emoji: '🧩', color: '#3b82f6' },
  { id: 'arcade', name: 'Arcade', emoji: '🕹️', color: '#ef4444' },
  { id: 'tycoon', name: 'Tycoon', emoji: '💰', color: '#22c55e' },
  { id: 'strategy', name: 'Strategy', emoji: '♟️', color: '#a855f7' },
  { id: '3d', name: '3D Games', emoji: '🎲', color: '#f97316' },
];

// Built-in games (static HTML) with thumbnails
const BUILTIN_GAMES = [
  { slug: 'puzzle-match', name: 'Puzzle Match', category: 'puzzle', file: '/games/puzzle/puzzle-match.html', thumbnail: 'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=400', description: 'Match puzzle pieces', max_reward: 50 },
  { slug: '2048', name: '2048', category: 'puzzle', file: '/games/puzzle/2048.html', thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400', description: 'Combine tiles to reach 2048', max_reward: 100 },
  { slug: 'memory', name: 'Memory', category: 'puzzle', file: '/games/puzzle/memory.html', thumbnail: 'https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=400', description: 'Test your memory', max_reward: 40 },
  { slug: 'runner', name: 'Runner', category: 'arcade', file: '/games/arcade/runner.html', thumbnail: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400', description: 'Run and dodge obstacles', max_reward: 80 },
  { slug: 'lucky-wheel', name: 'Lucky Wheel', category: 'arcade', file: '/games/arcade/lucky-wheel.html', thumbnail: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400', description: 'Spin to win coins', max_reward: 100 },
  { slug: 'scratch-card', name: 'Scratch Card', category: 'arcade', file: '/games/arcade/scratch-card.html', thumbnail: 'https://images.unsplash.com/photo-1565515636369-57f6e9f5fe15?w=400', description: 'Scratch and reveal prizes', max_reward: 100 },
  { slug: 'reaction', name: 'Reaction', category: 'arcade', file: '/games/arcade/reaction.html', thumbnail: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400', description: 'Test your reflexes', max_reward: 30 },
  { slug: 'snake', name: 'Snake', category: 'arcade', file: '/games/arcade/snake.html', thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400', description: 'Classic snake game', max_reward: 75 },
  { slug: 'coin-tycoon', name: 'Coin Tycoon', category: 'tycoon', file: '/games/tycoon/coin-tycoon.html', thumbnail: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400', description: 'Build your coin empire', max_reward: 120 },
  { slug: '3d-cube', name: '3D Cube', category: '3d', file: '/games/3d/cube-catch.html', thumbnail: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400', description: 'Catch cubes in 3D', max_reward: 150 },
];

export default function GamePlatform() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [games, setGames] = useState(BUILTIN_GAMES);
  const [selectedGame, setSelectedGame] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const userId = localStorage.getItem('userId') || 'guest';

  useEffect(() => {
    fetchCoins();
    fetchGames();
    fetchLeaderboard();
    
    // Hide main navbar
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    
    return () => {
      const header = document.querySelector('header');
      if (header) header.style.display = '';
    };
  }, []);

  const fetchCoins = async () => {
    try {
      const res = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(res.data.coins || 0);
    } catch {
      setCoins(100);
    }
  };

  const fetchGames = async () => {
    try {
      const res = await axios.get(`${API}/games`);
      if (res.data && res.data.length > 0) {
        setGames([...BUILTIN_GAMES, ...res.data]);
      }
    } catch {
      // Use built-in games only
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API}/games/leaderboard/global/top?limit=5`);
      setLeaderboard(res.data || []);
    } catch {
      setLeaderboard([]);
    }
  };

  const filteredGames = activeCategory === 'all' 
    ? games 
    : games.filter(g => g.category === activeCategory);

  const openGame = (game) => {
    if (game.file) {
      setSelectedGame(game);
    } else if (game.slug) {
      navigate(`/game/${game.slug}`);
    }
  };

  const closeGame = () => {
    setSelectedGame(null);
    fetchCoins();
    fetchLeaderboard();
  };

  // Listen for close message from iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'close') closeGame();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (selectedGame) {
    return (
      <div style={styles.gameContainer}>
        <div style={styles.gameHeader}>
          <span>{selectedGame.name}</span>
          <button style={styles.closeBtn} onClick={closeGame}>✕</button>
        </div>
        <iframe 
          src={selectedGame.file}
          style={styles.gameFrame}
          title={selectedGame.name}
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <span>🎮</span> BidBlitz Games
      </header>

      {/* Wallet Bar */}
      <div style={styles.wallet}>
        <span>🪙 {coins} Coins</span>
        <button style={styles.walletBtn} onClick={() => navigate('/wallet')}>+ Kaufen</button>
      </div>

      {/* Categories */}
      <div style={styles.categories}>
        <button 
          style={{
            ...styles.catBtn,
            background: activeCategory === 'all' ? '#a855f7' : '#1e293b',
          }}
          onClick={() => setActiveCategory('all')}
        >
          Alle
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            style={{
              ...styles.catBtn,
              background: activeCategory === cat.id ? cat.color : '#1e293b',
            }}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {/* Games Grid */}
      <div style={styles.gamesSection}>
        <h2 style={styles.sectionTitle}>
          {activeCategory === 'all' ? 'Alle Spiele' : CATEGORIES.find(c => c.id === activeCategory)?.name}
          <span style={styles.gameCount}>({filteredGames.length})</span>
        </h2>
        <div style={styles.gamesGrid}>
          {filteredGames.map((game, i) => (
            <div
              key={game.slug || i}
              style={styles.gameCard}
              onClick={() => openGame(game)}
              data-testid={`game-card-${game.slug || i}`}
            >
              <div style={styles.gameThumb}>
                {game.thumbnail ? (
                  <img src={game.thumbnail} alt={game.name} style={styles.thumbImg} />
                ) : (
                  <span style={styles.thumbEmoji}>
                    {CATEGORIES.find(c => c.id === game.category)?.emoji || '🎮'}
                  </span>
                )}
              </div>
              <div style={styles.gameName}>{game.name}</div>
              <div style={styles.gameCategory}>
                {CATEGORIES.find(c => c.id === game.category)?.name || game.category}
              </div>
              {game.max_reward > 0 && (
                <div style={styles.gameReward}>
                  +{game.max_reward} 🪙
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={styles.leaderboard}>
          <h2 style={styles.sectionTitle}>🏆 Top Players</h2>
          <div style={styles.leaderList}>
            {leaderboard.map((entry, i) => (
              <div key={i} style={styles.leaderRow}>
                <span style={styles.rank}>#{entry.rank}</span>
                <span style={styles.playerName}>{entry.user_name}</span>
                <span style={styles.playerScore}>{entry.total_score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav style={styles.bottomNav}>
        <div style={styles.navItem} onClick={() => navigate('/super-home')}>🏠</div>
        <div style={{...styles.navItem, color: '#a855f7'}}>🎮</div>
        <div style={styles.navItem} onClick={() => navigate('/wallet')}>💰</div>
        <div style={styles.navItem} onClick={() => navigate('/live-auction')}>🔥</div>
        <div style={styles.navItem} onClick={() => navigate('/profile')}>👤</div>
      </nav>

      <div style={{height: '80px'}} />
    </div>
  );
}

const styles = {
  page: {
    margin: 0,
    fontFamily: 'Arial, sans-serif',
    background: '#0f172a',
    color: 'white',
    minHeight: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
  },
  header: {
    background: '#020617',
    padding: '18px',
    fontSize: '24px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  wallet: {
    background: '#1e293b',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '16px',
  },
  walletBtn: {
    background: '#a855f7',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
  },
  categories: {
    display: 'flex',
    gap: '8px',
    padding: '15px',
    overflowX: 'auto',
  },
  catBtn: {
    padding: '10px 15px',
    border: 'none',
    borderRadius: '20px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  gamesSection: {
    padding: '0 15px',
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '15px',
  },
  gameCount: {
    color: '#94a3b8',
    fontSize: '14px',
    marginLeft: '8px',
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '16px',
  },
  gameCard: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '14px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  gameThumb: {
    width: '100%',
    aspectRatio: '1',
    background: '#374151',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
  },
  thumbEmoji: {
    fontSize: '32px',
  },
  gameName: {
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  gameCategory: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  leaderboard: {
    padding: '20px 15px',
  },
  leaderList: {
    background: '#1e293b',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  leaderRow: {
    display: 'flex',
    padding: '12px 15px',
    borderBottom: '1px solid #374151',
    alignItems: 'center',
  },
  rank: {
    width: '35px',
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  playerName: {
    flex: 1,
  },
  playerScore: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#020617',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '15px 10px',
    borderTop: '1px solid #1e293b',
  },
  navItem: {
    fontSize: '24px',
    cursor: 'pointer',
  },
  gameContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#0f172a',
    zIndex: 1000,
  },
  gameHeader: {
    background: '#020617',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '18px',
  },
  closeBtn: {
    background: '#ef4444',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
  },
  gameFrame: {
    width: '100%',
    height: 'calc(100% - 60px)',
    border: 'none',
  },
};
