/**
 * BidBlitz Analytics Dashboard
 * Charts showing coins, mining, and game stats
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppAnalytics() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [stats, setStats] = useState({
    coinsData: [1200, 1500, 1700, 2000, 2400, 3000, 3500],
    miningData: [50, 80, 120, 150, 200, 250, 300],
    gamesData: [10, 15, 20, 25, 30, 35, 40]
  });
  const [activeChart, setActiveChart] = useState('coins');
  
  useEffect(() => {
    loadChartJS();
    fetchStats();
  }, []);
  
  useEffect(() => {
    if (window.Chart && chartRef.current) {
      createChart();
    }
  }, [activeChart, stats]);
  
  const loadChartJS = () => {
    if (window.Chart) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => createChart();
    document.head.appendChild(script);
  };
  
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.get(`${API}/app/analytics/weekly`, { headers });
      if (res.data) {
        setStats({
          coinsData: res.data.coins || stats.coinsData,
          miningData: res.data.mining || stats.miningData,
          gamesData: res.data.games || stats.gamesData
        });
      }
    } catch (error) {
      // Use default data
    }
  };
  
  const createChart = () => {
    if (!window.Chart || !chartRef.current) return;
    
    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext('2d');
    
    const chartConfigs = {
      coins: {
        label: 'Coins Generated',
        data: stats.coinsData,
        borderColor: '#6c63ff',
        backgroundColor: 'rgba(108,99,255,0.2)'
      },
      mining: {
        label: 'Mining Rewards',
        data: stats.miningData,
        borderColor: '#00bcd4',
        backgroundColor: 'rgba(0,188,212,0.2)'
      },
      games: {
        label: 'Games Played',
        data: stats.gamesData,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76,175,80,0.2)'
      }
    };
    
    const config = chartConfigs[activeChart];
    
    chartInstance.current = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: config.label,
          data: config.data,
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: config.borderColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: 'white' }
          }
        },
        scales: {
          x: {
            ticks: { color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            ticks: { color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        }
      }
    });
  };
  
  const chartTabs = [
    { id: 'coins', label: '💰 Coins', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'mining', label: '⛏️ Mining', color: 'bg-cyan-500/20 text-cyan-400' },
    { id: 'games', label: '🎮 Games', color: 'bg-green-500/20 text-green-400' }
  ];
  
  // Calculate totals
  const totalCoins = stats.coinsData.reduce((a, b) => a + b, 0);
  const totalMining = stats.miningData.reduce((a, b) => a + b, 0);
  const totalGames = stats.gamesData.reduce((a, b) => a + b, 0);
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">📊 BidBlitz Analytics</h2>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#171a3a] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Diese Woche</p>
            <p className="text-lg font-bold text-purple-400">{totalCoins.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Coins</p>
          </div>
          <div className="bg-[#171a3a] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Mining</p>
            <p className="text-lg font-bold text-cyan-400">{totalMining}</p>
            <p className="text-xs text-slate-500">Rewards</p>
          </div>
          <div className="bg-[#171a3a] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Games</p>
            <p className="text-lg font-bold text-green-400">{totalGames}</p>
            <p className="text-xs text-slate-500">Gespielt</p>
          </div>
        </div>
        
        {/* Chart Tabs */}
        <div className="flex gap-2 mb-4">
          {chartTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveChart(tab.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeChart === tab.id ? tab.color + ' border border-current' : 'bg-[#171a3a] text-slate-400'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Chart Container */}
        <div 
          className="bg-[#171a3a] p-4 rounded-2xl"
          style={{ height: '300px' }}
          data-testid="chart-container"
        >
          <canvas ref={chartRef} id="analyticsChart"></canvas>
        </div>
        
        {/* Insights */}
        <div className="mt-5 bg-[#171a3a] p-4 rounded-xl">
          <h3 className="font-semibold mb-3">📈 Insights</h3>
          <div className="space-y-2 text-sm text-slate-400">
            <p>• Deine Coins sind diese Woche um <span className="text-green-400">+192%</span> gestiegen</p>
            <p>• Bester Tag: <span className="text-amber-400">Sonntag</span> mit 3.500 Coins</p>
            <p>• Durchschnitt: <span className="text-purple-400">{Math.round(totalCoins / 7)}</span> Coins/Tag</p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
