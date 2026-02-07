import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Star, TrendingUp, Users, RefreshCw, 
  ThumbsUp, ThumbsDown, Meh, Eye, Calendar, Filter,
  Download, Smile, Frown
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CHART_COLORS = {
  promoter: '#10B981',
  passive: '#F59E0B',
  detractor: '#EF4444',
  primary: '#06B6D4'
};

const AdminSurveys = ({ token }) => {
  const [data, setData] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [surveyType, setSurveyType] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, responsesRes] = await Promise.all([
        axios.get(`${API}/api/surveys/analytics?days=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/surveys/responses?limit=50&type=${surveyType}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { responses: [] } }))
      ]);
      
      setData(analyticsRes.data);
      setResponses(responsesRes.data.responses || []);
    } catch (error) {
      console.error('Surveys error:', error);
      // Mock data for demo
      setData({
        nps: {
          score: 42,
          promoters: 45,
          passives: 32,
          detractors: 23,
          total_responses: 100,
          trend: [
            { month: 'Sep', score: 35 },
            { month: 'Okt', score: 38 },
            { month: 'Nov', score: 41 },
            { month: 'Dez', score: 40 },
            { month: 'Jan', score: 42 }
          ]
        },
        satisfaction: {
          avg_rating: 4.2,
          total_ratings: 256,
          distribution: [
            { rating: 5, count: 102 },
            { rating: 4, count: 89 },
            { rating: 3, count: 42 },
            { rating: 2, count: 15 },
            { rating: 1, count: 8 }
          ]
        },
        survey_types: [
          { type: 'nps', count: 100, label: 'NPS' },
          { type: 'post_win', count: 85, label: 'Nach Gewinn' },
          { type: 'post_purchase', count: 71, label: 'Nach Kauf' }
        ],
        recent_feedback: [
          { id: '1', user: 'MaxBieter', type: 'nps', score: 9, feedback: 'Super Plattform! Habe schon 3x gewonnen.', date: '2026-02-05' },
          { id: '2', user: 'LuckyWinner', type: 'post_win', score: 5, feedback: 'Schnelle Lieferung, top Qualität!', date: '2026-02-04' },
          { id: '3', user: 'BidMaster', type: 'nps', score: 7, feedback: 'Gut, aber mehr Auktionen wären super.', date: '2026-02-03' },
          { id: '4', user: 'NewUser22', type: 'post_purchase', score: 4, feedback: 'Einfacher Kaufprozess.', date: '2026-02-02' },
          { id: '5', user: 'AuctionPro', type: 'nps', score: 10, feedback: 'Beste Auktionsseite!', date: '2026-02-01' }
        ]
      });
      setResponses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, surveyType, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!data) return null;

  // Safe access with defaults
  const nps = data.nps || { score: 0, promoters: 0, passives: 0, detractors: 0, total_responses: 0, trend: [] };
  const satisfaction = data.satisfaction || { avg_rating: 0, total_ratings: 0, distribution: [] };
  const recentFeedback = data.recent_feedback || [];

  // NPS Distribution for Pie Chart
  const npsDistribution = [
    { name: 'Promoter (9-10)', value: nps.promoters, color: CHART_COLORS.promoter },
    { name: 'Passiv (7-8)', value: nps.passives, color: CHART_COLORS.passive },
    { name: 'Kritiker (0-6)', value: nps.detractors, color: CHART_COLORS.detractor }
  ];

  return (
    <div className="space-y-6" data-testid="admin-surveys">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-cyan-500" />
            Umfragen & Feedback
          </h2>
          <p className="text-gray-400 text-sm">NPS-Scores, Bewertungen und Kundenfeedback</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={7}>Letzte 7 Tage</option>
            <option value={30}>Letzte 30 Tage</option>
            <option value={90}>Letzte 90 Tage</option>
          </select>
          <Button 
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* NPS Score Card */}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl p-6 border border-cyan-500/30">
          <div className="text-gray-400 text-sm mb-2">Net Promoter Score</div>
          <div className={`text-5xl font-bold ${
            nps.score >= 50 ? 'text-green-500' : 
            nps.score >= 0 ? 'text-amber-500' : 'text-red-500'
          }`}>
            {nps.score}
          </div>
          <div className="text-gray-500 text-xs mt-2">
            {nps.score >= 50 ? 'Exzellent' : nps.score >= 30 ? 'Gut' : nps.score >= 0 ? 'Verbesserungsbedarf' : 'Kritisch'}
          </div>
          <div className="mt-4 text-sm text-gray-400">
            {nps.total_responses} Antworten
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsUp className="w-5 h-5 text-green-500" />
            <span className="text-gray-400 text-sm">Promoter</span>
          </div>
          <div className="text-3xl font-bold text-green-500">{nps.promoters}</div>
          <div className="text-gray-500 text-xs">Würden empfehlen (9-10)</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Meh className="w-5 h-5 text-amber-500" />
            <span className="text-gray-400 text-sm">Passiv</span>
          </div>
          <div className="text-3xl font-bold text-amber-500">{nps.passives}</div>
          <div className="text-gray-500 text-xs">Zufrieden (7-8)</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsDown className="w-5 h-5 text-red-500" />
            <span className="text-gray-400 text-sm">Kritiker</span>
          </div>
          <div className="text-3xl font-bold text-red-500">{nps.detractors}</div>
          <div className="text-gray-500 text-xs">Unzufrieden (0-6)</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* NPS Distribution Pie */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">NPS Verteilung</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={npsDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {npsDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                formatter={(value, name) => [value, name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* NPS Trend */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-500" />
            NPS Entwicklung
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={nps.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" domain={[-100, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke={CHART_COLORS.primary} 
                strokeWidth={3}
                dot={{ fill: CHART_COLORS.primary, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Satisfaction Rating */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Durchschnittliche Bewertung
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold text-amber-500">{(satisfaction.avg_rating || 0).toFixed(1)}</div>
            <div className="flex flex-col">
              <div className="flex">
                {[1,2,3,4,5].map(i => (
                  <Star 
                    key={i} 
                    className={`w-5 h-5 ${i <= Math.round(satisfaction.avg_rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-gray-600'}`} 
                  />
                ))}
              </div>
              <span className="text-gray-500 text-sm">{satisfaction.total_ratings || 0} Bewertungen</span>
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="lg:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Bewertungsverteilung</h3>
          <div className="space-y-3">
            {(satisfaction.distribution || []).map((item) => (
              <div key={item.rating} className="flex items-center gap-3">
                <span className="text-gray-400 w-6">{item.rating}★</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full ${
                      item.rating >= 4 ? 'bg-green-500' : 
                      item.rating === 3 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${satisfaction.total_ratings > 0 ? (item.count / satisfaction.total_ratings) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-gray-400 w-12 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-500" />
          Neuestes Feedback
        </h3>
        <div className="space-y-4">
          {recentFeedback.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Noch kein Feedback vorhanden</p>
          ) : (
            recentFeedback.map((feedback) => (
            <div 
              key={feedback.id}
              className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/50"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                feedback.score >= 9 ? 'bg-green-500/20' :
                feedback.score >= 7 ? 'bg-amber-500/20' : 'bg-red-500/20'
              }`}>
                {feedback.score >= 9 ? <Smile className="w-5 h-5 text-green-500" /> :
                 feedback.score >= 7 ? <Meh className="w-5 h-5 text-amber-500" /> :
                 <Frown className="w-5 h-5 text-red-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">{feedback.user}</span>
                  <span className="text-gray-500 text-xs">{feedback.date}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    feedback.type === 'nps' ? 'bg-cyan-500/20 text-cyan-400' :
                    feedback.type === 'post_win' ? 'bg-green-500/20 text-green-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {feedback.type === 'nps' ? 'NPS' : feedback.type === 'post_win' ? 'Nach Gewinn' : 'Nach Kauf'}
                  </span>
                  <span className={`font-bold ${
                    feedback.score >= 9 ? 'text-green-500' :
                    feedback.score >= 7 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {feedback.score}/10
                  </span>
                </div>
                {feedback.feedback && (
                  <p className="text-gray-400 text-sm italic">&ldquo;{feedback.feedback}&rdquo;</p>
                )}
              </div>
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSurveys;
