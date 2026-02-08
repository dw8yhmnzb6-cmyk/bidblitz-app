import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { 
  Trophy, TrendingUp, Target, Award, 
  Flame, Star, Crown, Calendar,
  BarChart3, PieChart, Zap, Gift
} from 'lucide-react';
import { Progress } from '../components/ui/progress';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: { title: 'Meine Statistiken', overview: 'Übersicht', totalWins: 'Gesamtsiege', totalBids: 'Gebote platziert', totalSavings: 'Gespart', winRate: 'Gewinnrate', level: 'Level', achievements: 'Erfolge', weeklyActivity: 'Diese Woche', favoriteCategories: 'Lieblingskategorien', streak: 'Login-Streak', days: 'Tage', memberSince: 'Mitglied seit', pointsNeeded: 'Punkte bis', unlocked: 'Freigeschaltet', locked: 'Gesperrt', progress: 'Fortschritt', noStats: 'Noch keine Statistiken', startBidding: 'Beginne zu bieten um Statistiken zu sammeln!' },
  en: { title: 'My Statistics', overview: 'Overview', totalWins: 'Total Wins', totalBids: 'Bids Placed', totalSavings: 'Total Saved', winRate: 'Win Rate', level: 'Level', achievements: 'Achievements', weeklyActivity: 'This Week', favoriteCategories: 'Favorite Categories', streak: 'Login Streak', days: 'Days', memberSince: 'Member Since', pointsNeeded: 'Points until', unlocked: 'Unlocked', locked: 'Locked', progress: 'Progress', noStats: 'No statistics yet', startBidding: 'Start bidding to collect statistics!' },
  us: { title: 'My Statistics', overview: 'Overview', totalWins: 'Total Wins', totalBids: 'Bids Placed', totalSavings: 'Total Saved', winRate: 'Win Rate', level: 'Level', achievements: 'Achievements', weeklyActivity: 'This Week', favoriteCategories: 'Favorite Categories', streak: 'Login Streak', days: 'Days', memberSince: 'Member Since', pointsNeeded: 'Points until', unlocked: 'Unlocked', locked: 'Locked', progress: 'Progress', noStats: 'No statistics yet', startBidding: 'Start bidding to collect statistics!' },
  fr: { title: 'Mes Statistiques', overview: 'Aperçu', totalWins: 'Victoires Totales', totalBids: 'Enchères Placées', totalSavings: 'Total Économisé', winRate: 'Taux de Victoire', level: 'Niveau', achievements: 'Réussites', weeklyActivity: 'Cette Semaine', favoriteCategories: 'Catégories Favorites', streak: 'Série de Connexion', days: 'Jours', memberSince: 'Membre Depuis', pointsNeeded: 'Points jusqu\'à', unlocked: 'Débloqué', locked: 'Verrouillé', progress: 'Progression', noStats: 'Pas encore de statistiques', startBidding: 'Commencez à enchérir pour collecter des statistiques!' },
  es: { title: 'Mis Estadísticas', overview: 'Resumen', totalWins: 'Victorias Totales', totalBids: 'Pujas Realizadas', totalSavings: 'Total Ahorrado', winRate: 'Tasa de Victoria', level: 'Nivel', achievements: 'Logros', weeklyActivity: 'Esta Semana', favoriteCategories: 'Categorías Favoritas', streak: 'Racha de Conexión', days: 'Días', memberSince: 'Miembro Desde', pointsNeeded: 'Puntos hasta', unlocked: 'Desbloqueado', locked: 'Bloqueado', progress: 'Progreso', noStats: 'Sin estadísticas aún', startBidding: '¡Empieza a pujar para recolectar estadísticas!' },
  it: { title: 'Le Mie Statistiche', overview: 'Panoramica', totalWins: 'Vittorie Totali', totalBids: 'Offerte Piazzate', totalSavings: 'Totale Risparmiato', winRate: 'Tasso di Vittoria', level: 'Livello', achievements: 'Traguardi', weeklyActivity: 'Questa Settimana', favoriteCategories: 'Categorie Preferite', streak: 'Serie di Accesso', days: 'Giorni', memberSince: 'Membro Dal', pointsNeeded: 'Punti fino a', unlocked: 'Sbloccato', locked: 'Bloccato', progress: 'Progresso', noStats: 'Nessuna statistica ancora', startBidding: 'Inizia a offrire per raccogliere statistiche!' },
  pt: { title: 'Minhas Estatísticas', overview: 'Visão Geral', totalWins: 'Vitórias Totais', totalBids: 'Lances Feitos', totalSavings: 'Total Economizado', winRate: 'Taxa de Vitória', level: 'Nível', achievements: 'Conquistas', weeklyActivity: 'Esta Semana', favoriteCategories: 'Categorias Favoritas', streak: 'Sequência de Login', days: 'Dias', memberSince: 'Membro Desde', pointsNeeded: 'Pontos até', unlocked: 'Desbloqueado', locked: 'Bloqueado', progress: 'Progresso', noStats: 'Sem estatísticas ainda', startBidding: 'Comece a licitar para coletar estatísticas!' },
  nl: { title: 'Mijn Statistieken', overview: 'Overzicht', totalWins: 'Totale Winsten', totalBids: 'Biedingen Geplaatst', totalSavings: 'Totaal Bespaard', winRate: 'Winstkans', level: 'Niveau', achievements: 'Prestaties', weeklyActivity: 'Deze Week', favoriteCategories: 'Favoriete Categorieën', streak: 'Login Reeks', days: 'Dagen', memberSince: 'Lid Sinds', pointsNeeded: 'Punten tot', unlocked: 'Ontgrendeld', locked: 'Vergrendeld', progress: 'Voortgang', noStats: 'Nog geen statistieken', startBidding: 'Begin te bieden om statistieken te verzamelen!' },
  pl: { title: 'Moje Statystyki', overview: 'Przegląd', totalWins: 'Łączne Wygrane', totalBids: 'Złożone Oferty', totalSavings: 'Łącznie Zaoszczędzone', winRate: 'Współczynnik Wygranych', level: 'Poziom', achievements: 'Osiągnięcia', weeklyActivity: 'Ten Tydzień', favoriteCategories: 'Ulubione Kategorie', streak: 'Seria Logowań', days: 'Dni', memberSince: 'Członek Od', pointsNeeded: 'Punkty do', unlocked: 'Odblokowane', locked: 'Zablokowane', progress: 'Postęp', noStats: 'Brak statystyk jeszcze', startBidding: 'Zacznij licytować, aby zbierać statystyki!' },
  tr: { title: 'İstatistiklerim', overview: 'Genel Bakış', totalWins: 'Toplam Kazanımlar', totalBids: 'Verilen Teklifler', totalSavings: 'Toplam Tasarruf', winRate: 'Kazanma Oranı', level: 'Seviye', achievements: 'Başarılar', weeklyActivity: 'Bu Hafta', favoriteCategories: 'Favori Kategoriler', streak: 'Giriş Serisi', days: 'Gün', memberSince: 'Üyelik Tarihi', pointsNeeded: 'Puan gereken', unlocked: 'Açıldı', locked: 'Kilitli', progress: 'İlerleme', noStats: 'Henüz istatistik yok', startBidding: 'İstatistik toplamak için teklif vermeye başlayın!' },
  ru: { title: 'Моя Статистика', overview: 'Обзор', totalWins: 'Всего Побед', totalBids: 'Сделано Ставок', totalSavings: 'Всего Сэкономлено', winRate: 'Процент Побед', level: 'Уровень', achievements: 'Достижения', weeklyActivity: 'На Этой Неделе', favoriteCategories: 'Любимые Категории', streak: 'Серия Входов', days: 'Дней', memberSince: 'Участник С', pointsNeeded: 'Очков до', unlocked: 'Разблокировано', locked: 'Заблокировано', progress: 'Прогресс', noStats: 'Статистики пока нет', startBidding: 'Начните делать ставки для сбора статистики!' },
  ar: { title: 'إحصائياتي', overview: 'نظرة عامة', totalWins: 'إجمالي الانتصارات', totalBids: 'العروض المقدمة', totalSavings: 'إجمالي التوفير', winRate: 'معدل الفوز', level: 'المستوى', achievements: 'الإنجازات', weeklyActivity: 'هذا الأسبوع', favoriteCategories: 'الفئات المفضلة', streak: 'سلسلة الدخول', days: 'أيام', memberSince: 'عضو منذ', pointsNeeded: 'نقاط حتى', unlocked: 'مفتوح', locked: 'مقفل', progress: 'التقدم', noStats: 'لا توجد إحصائيات بعد', startBidding: 'ابدأ المزايدة لجمع الإحصائيات!' },
  ae: { title: 'إحصائياتي', overview: 'نظرة عامة', totalWins: 'إجمالي الانتصارات', totalBids: 'العروض المقدمة', totalSavings: 'إجمالي التوفير', winRate: 'معدل الفوز', level: 'المستوى', achievements: 'الإنجازات', weeklyActivity: 'هذا الأسبوع', favoriteCategories: 'الفئات المفضلة', streak: 'سلسلة الدخول', days: 'أيام', memberSince: 'عضو منذ', pointsNeeded: 'نقاط حتى', unlocked: 'مفتوح', locked: 'مقفل', progress: 'التقدم', noStats: 'لا توجد إحصائيات بعد', startBidding: 'ابدأ المزايدة لجمع الإحصائيات!' },
  zh: { title: '我的统计', overview: '概览', totalWins: '总获胜', totalBids: '已出价', totalSavings: '总节省', winRate: '胜率', level: '等级', achievements: '成就', weeklyActivity: '本周', favoriteCategories: '喜爱类别', streak: '登录连击', days: '天', memberSince: '成员自', pointsNeeded: '积分至', unlocked: '已解锁', locked: '已锁定', progress: '进度', noStats: '暂无统计', startBidding: '开始出价以收集统计数据！' },
  ja: { title: 'マイ統計', overview: '概要', totalWins: '総勝利', totalBids: '入札数', totalSavings: '総節約', winRate: '勝率', level: 'レベル', achievements: '実績', weeklyActivity: '今週', favoriteCategories: 'お気に入りカテゴリ', streak: 'ログイン連続', days: '日', memberSince: '会員登録日', pointsNeeded: 'ポイントまで', unlocked: '解除済み', locked: 'ロック中', progress: '進捗', noStats: 'まだ統計がありません', startBidding: '入札を開始して統計を収集！' },
  ko: { title: '내 통계', overview: '개요', totalWins: '총 승리', totalBids: '입찰 수', totalSavings: '총 절약', winRate: '승률', level: '레벨', achievements: '업적', weeklyActivity: '이번 주', favoriteCategories: '선호 카테고리', streak: '로그인 연속', days: '일', memberSince: '가입일', pointsNeeded: '포인트까지', unlocked: '잠금 해제', locked: '잠김', progress: '진행률', noStats: '아직 통계 없음', startBidding: '입찰을 시작하여 통계를 수집하세요!' },
  hi: { title: 'मेरे आंकड़े', overview: 'अवलोकन', totalWins: 'कुल जीत', totalBids: 'बोलियां लगाईं', totalSavings: 'कुल बचत', winRate: 'जीत दर', level: 'स्तर', achievements: 'उपलब्धियां', weeklyActivity: 'इस सप्ताह', favoriteCategories: 'पसंदीदा श्रेणियां', streak: 'लॉगिन स्ट्रीक', days: 'दिन', memberSince: 'सदस्य तब से', pointsNeeded: 'अंक तक', unlocked: 'अनलॉक', locked: 'लॉक', progress: 'प्रगति', noStats: 'अभी तक कोई आंकड़े नहीं', startBidding: 'आंकड़े एकत्र करने के लिए बोली लगाना शुरू करें!' },
  sq: { title: 'Statistikat e Mia', overview: 'Përmbledhje', totalWins: 'Fitimet Totale', totalBids: 'Ofertat e Vendosura', totalSavings: 'Totali i Kursyer', winRate: 'Shkalla e Fitimit', level: 'Niveli', achievements: 'Arritjet', weeklyActivity: 'Këtë Javë', favoriteCategories: 'Kategoritë e Preferuara', streak: 'Seria e Hyrjes', days: 'Ditë', memberSince: 'Anëtar Që Nga', pointsNeeded: 'Pikë deri', unlocked: 'Zhbllokuar', locked: 'Bllokuar', progress: 'Progresi', noStats: 'Ende pa statistika', startBidding: 'Filloni të ofroni për të mbledhur statistika!' },
  xk: { title: 'Statistikat e Mia', overview: 'Përmbledhje', totalWins: 'Fitimet Totale', totalBids: 'Ofertat e Vendosura', totalSavings: 'Totali i Kursyer', winRate: 'Shkalla e Fitimit', level: 'Niveli', achievements: 'Arritjet', weeklyActivity: 'Këtë Javë', favoriteCategories: 'Kategoritë e Preferuara', streak: 'Seria e Hyrjes', days: 'Ditë', memberSince: 'Anëtar Që Nga', pointsNeeded: 'Pikë deri', unlocked: 'Zhbllokuar', locked: 'Bllokuar', progress: 'Progresi', noStats: 'Ende pa statistika', startBidding: 'Filloni të ofroni për të mbledhur statistika!' },
  cs: { title: 'Moje statistiky', overview: 'Přehled', totalWins: 'Celkové výhry', totalBids: 'Podané nabídky', totalSavings: 'Celkem ušetřeno', winRate: 'Míra výher', level: 'Úroveň', achievements: 'Úspěchy', weeklyActivity: 'Tento týden', favoriteCategories: 'Oblíbené kategorie', streak: 'Série přihlášení', days: 'Dní', memberSince: 'Člen od', pointsNeeded: 'Bodů do', unlocked: 'Odemčeno', locked: 'Zamčeno', progress: 'Pokrok', noStats: 'Zatím žádné statistiky', startBidding: 'Začněte nabízet pro sběr statistik!' },
  sv: { title: 'Min statistik', overview: 'Översikt', totalWins: 'Totala vinster', totalBids: 'Lagda bud', totalSavings: 'Totalt sparat', winRate: 'Vinstfrekvens', level: 'Nivå', achievements: 'Prestationer', weeklyActivity: 'Denna vecka', favoriteCategories: 'Favoritkategorier', streak: 'Inloggningsserie', days: 'Dagar', memberSince: 'Medlem sedan', pointsNeeded: 'Poäng till', unlocked: 'Upplåst', locked: 'Låst', progress: 'Framsteg', noStats: 'Ingen statistik ännu', startBidding: 'Börja buda för att samla statistik!' },
  da: { title: 'Min statistik', overview: 'Oversigt', totalWins: 'Samlede sejre', totalBids: 'Afgivne bud', totalSavings: 'Samlet sparet', winRate: 'Gevinstrate', level: 'Niveau', achievements: 'Præstationer', weeklyActivity: 'Denne uge', favoriteCategories: 'Favoritkategorier', streak: 'Login-serie', days: 'Dage', memberSince: 'Medlem siden', pointsNeeded: 'Point til', unlocked: 'Låst op', locked: 'Låst', progress: 'Fremskridt', noStats: 'Ingen statistik endnu', startBidding: 'Begynd at byde for at samle statistik!' },
  fi: { title: 'Tilastoni', overview: 'Yleiskatsaus', totalWins: 'Voitot yhteensä', totalBids: 'Tehdyt tarjoukset', totalSavings: 'Säästetty yhteensä', winRate: 'Voittoprosentti', level: 'Taso', achievements: 'Saavutukset', weeklyActivity: 'Tällä viikolla', favoriteCategories: 'Suosikkikategoriat', streak: 'Kirjautumissarja', days: 'Päivää', memberSince: 'Jäsen alkaen', pointsNeeded: 'Pistettä kunnes', unlocked: 'Avattu', locked: 'Lukittu', progress: 'Edistyminen', noStats: 'Ei vielä tilastoja', startBidding: 'Aloita tarjoaminen kerätäksesi tilastoja!' },
  el: { title: 'Τα Στατιστικά μου', overview: 'Επισκόπηση', totalWins: 'Συνολικές Νίκες', totalBids: 'Προσφορές', totalSavings: 'Συνολική Εξοικονόμηση', winRate: 'Ποσοστό Νίκης', level: 'Επίπεδο', achievements: 'Επιτεύγματα', weeklyActivity: 'Αυτή την Εβδομάδα', favoriteCategories: 'Αγαπημένες Κατηγορίες', streak: 'Σειρά Συνδέσεων', days: 'Ημέρες', memberSince: 'Μέλος από', pointsNeeded: 'Πόντοι μέχρι', unlocked: 'Ξεκλείδωτο', locked: 'Κλειδωμένο', progress: 'Πρόοδος', noStats: 'Δεν υπάρχουν στατιστικά ακόμα', startBidding: 'Ξεκινήστε να προσφέρετε για να συλλέξετε στατιστικά!' }
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color = "cyan" }) => (
  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-white font-bold text-xl">{value}</p>
        {subValue && <p className="text-gray-500 text-xs">{subValue}</p>}
      </div>
    </div>
  </div>
);

// Achievement Badge Component
const AchievementBadge = ({ achievement, t }) => (
  <div 
    className={`p-3 rounded-xl border ${
      achievement.unlocked 
        ? 'bg-gradient-to-b from-yellow-500/10 to-amber-500/10 border-yellow-500/30' 
        : 'bg-gray-800/30 border-gray-700/30 opacity-50'
    }`}
    title={achievement.description}
  >
    <div className="text-center">
      <span className="text-3xl">{achievement.icon}</span>
      <p className={`text-xs font-bold mt-1 ${achievement.unlocked ? 'text-yellow-400' : 'text-gray-500'}`}>
        {achievement.name}
      </p>
      {!achievement.unlocked && (
        <div className="mt-2">
          <Progress value={achievement.progress || 0} className="h-1" />
          <p className="text-[10px] text-gray-500 mt-1">{Math.round(achievement.progress || 0)}%</p>
        </div>
      )}
    </div>
  </div>
);

export default function UserStatsPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const t = translations[mappedLanguage] || translations[langKey] || translations.de;
  
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState({ unlocked: [], locked: [] });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStats = async () => {
      if (!isAuthenticated) return;
      
      try {
        const [statsRes, achievementsRes] = await Promise.all([
          axios.get(`${API}/api/user-stats/overview`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API}/api/user-stats/achievements`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { unlocked: [], locked: [] } }))
        ]);
        
        setStats(statsRes.data);
        setAchievements(achievementsRes.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [isAuthenticated, token]);
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Bitte anmelden</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Lade Statistiken...</p>
        </div>
      </div>
    );
  }
  
  const overview = stats?.overview || {};
  const level = stats?.level || {};
  const streak = stats?.streak || {};
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4" data-testid="user-stats-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          
          {/* Level Badge */}
          {level.name && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
              <span className="text-2xl">{level.icon}</span>
              <span className="text-yellow-400 font-bold">{level.name}</span>
              <span className="text-gray-400 text-sm">({level.points} Punkte)</span>
            </div>
          )}
          
          {/* Progress to next level */}
          {level.next_level && (
            <div className="mt-3 max-w-xs mx-auto">
              <Progress value={level.progress_to_next} className="h-2" />
              <p className="text-gray-500 text-xs mt-1">
                {level.points_needed} {t.pointsNeeded} {level.next_level}
              </p>
            </div>
          )}
        </div>
        
        {/* Overview Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={Trophy} 
            label={t.totalWins} 
            value={overview.total_wins || 0}
            color="yellow"
          />
          <StatCard 
            icon={Zap} 
            label={t.totalBids} 
            value={overview.total_bids || 0}
            color="blue"
          />
          <StatCard 
            icon={Gift} 
            label={t.totalSavings} 
            value={`€${(overview.total_savings || 0).toLocaleString('de-DE')}`}
            subValue={`${overview.savings_percentage || 0}% Ersparnis`}
            color="green"
          />
          <StatCard 
            icon={Target} 
            label={t.winRate} 
            value={`${overview.win_rate || 0}%`}
            color="purple"
          />
        </div>
        
        {/* Streak & Weekly Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Login Streak */}
          <div className="bg-gradient-to-b from-orange-500/10 to-red-500/10 rounded-xl p-5 border border-orange-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                {t.streak}
              </h3>
              <span className="text-orange-400 font-bold text-2xl">{streak.current || 0}</span>
            </div>
            <p className="text-gray-400 text-sm">
              {streak.current || 0} {t.days} in Folge
            </p>
            {streak.best > streak.current && (
              <p className="text-gray-500 text-xs mt-1">
                Bester: {streak.best} {t.days}
              </p>
            )}
          </div>
          
          {/* Weekly Activity */}
          <div className="bg-gradient-to-b from-cyan-500/10 to-blue-500/10 rounded-xl p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                {t.weeklyActivity}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-xs">Siege</p>
                <p className="text-white font-bold text-xl">{stats?.weekly_activity?.wins || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Gespart</p>
                <p className="text-green-400 font-bold text-xl">€{stats?.weekly_activity?.savings || 0}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Favorite Categories */}
        {stats?.favorite_categories?.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 mb-8">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              {t.favoriteCategories}
            </h3>
            <div className="space-y-3">
              {stats.favorite_categories.map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i] || '•'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-white">{cat.category}</span>
                      <span className="text-gray-400">{cat.wins} Siege</span>
                    </div>
                    <Progress value={(cat.wins / (stats.overview?.total_wins || 1)) * 100} className="h-1 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Achievements */}
        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            {t.achievements}
            <span className="text-gray-500 text-sm ml-2">
              ({achievements.unlocked?.length || 0}/{(achievements.unlocked?.length || 0) + (achievements.locked?.length || 0)})
            </span>
          </h3>
          
          {/* Unlocked */}
          {achievements.unlocked?.length > 0 && (
            <div className="mb-6">
              <p className="text-green-400 text-xs font-bold mb-3">{t.unlocked}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {achievements.unlocked.map(achievement => (
                  <AchievementBadge key={achievement.id} achievement={achievement} t={t} />
                ))}
              </div>
            </div>
          )}
          
          {/* Locked */}
          {achievements.locked?.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold mb-3">{t.locked}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {achievements.locked.slice(0, 10).map(achievement => (
                  <AchievementBadge key={achievement.id} achievement={achievement} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Member Since */}
        {stats?.member_since && (
          <p className="text-center text-gray-500 text-sm mt-8">
            {t.memberSince}: {new Date(stats.member_since).toLocaleDateString('de-DE')}
          </p>
        )}
      </div>
    </div>
  );
}
