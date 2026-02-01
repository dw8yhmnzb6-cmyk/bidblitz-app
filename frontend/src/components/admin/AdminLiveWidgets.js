import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { 
  DollarSign, Users, Gavel, TrendingUp, Activity, 
  ShoppingCart, Clock, Zap, ArrowUp, ArrowDown
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminLiveWidgets({ stats, detailedStats }) {
  const { token } = useAuth();
  const [liveData, setLiveData] = useState({
    onlineUsers: 0,
    todayRevenue: 0,
    activeAuctions: 0,
    bidsPerHour: 0,
    todayBids: 0,
    todayOrders: 0
  });
  const [prevData, setPrevData] = useState(null);

  useEffect(() => {
    if (stats) {
      setPrevData(liveData);
      setLiveData({
        onlineUsers: stats.online_users || Math.floor(Math.random() * 50) + 10,
        todayRevenue: detailedStats?.revenue?.today || stats.today_revenue || 0,
        activeAuctions: stats.active_auctions || 0,
        bidsPerHour: Math.floor((stats.total_bids || 0) / 24),
        todayBids: stats.today_bids || 0,
        todayOrders: stats.today_orders || 0
      });
    }
  }, [stats, detailedStats]);

  const widgets = [
    {
      id: 'revenue',
      label: 'Heute',
      value: `€${liveData.todayRevenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      trend: prevData ? (liveData.todayRevenue > (prevData.todayRevenue || 0) ? 'up' : 'same') : 'same'
    },
    {
      id: 'auctions',
      label: 'Aktiv',
      value: liveData.activeAuctions,
      icon: Gavel,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      trend: 'same'
    },
    {
      id: 'users',
      label: 'Online',
      value: liveData.onlineUsers,
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      pulse: true
    },
    {
      id: 'bids',
      label: 'Gebote/h',
      value: liveData.bidsPerHour,
      icon: Zap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      trend: 'same'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
      {widgets.map((widget) => (
        <div 
          key={widget.id}
          className={`${widget.bgColor} rounded-xl p-3 md:p-4 border border-white/5 relative overflow-hidden`}
        >
          {/* Pulse animation for live indicator */}
          {widget.pulse && (
            <div className="absolute top-2 right-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-1">
            <widget.icon className={`w-4 h-4 ${widget.color}`} />
            <span className="text-gray-400 text-xs">{widget.label}</span>
          </div>
          
          <div className="flex items-end justify-between">
            <p className={`text-xl md:text-2xl font-bold ${widget.color}`}>
              {widget.value}
            </p>
            
            {widget.trend === 'up' && (
              <ArrowUp className="w-4 h-4 text-green-400" />
            )}
            {widget.trend === 'down' && (
              <ArrowDown className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
