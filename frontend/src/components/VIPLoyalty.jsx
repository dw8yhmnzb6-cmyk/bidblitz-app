/**
 * VIPLoyalty - Treueprogramm mit Stufen und Vorteilen
 * Features: Bronze/Silber/Gold/Platin, Punkte sammeln, Vorteile
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, Star, Gift, TrendingUp, Award, Calendar, RefreshCw,
  ChevronRight, Lock, Unlock, Zap, Percent, Users, Clock, Trophy
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Tier Colors and Icons
const TIER_CONFIG = {
  bronze: { color: '#CD7F32', bgColor: 'from-amber-900/50 to-amber-800/50', icon: Star },
  silver: { color: '#C0C0C0', bgColor: 'from-gray-500/50 to-gray-400/50', icon: Star },
  gold: { color: '#FFD700', bgColor: 'from-yellow-600/50 to-yellow-500/50', icon: Crown },
  platinum: { color: '#E5E4E2', bgColor: 'from-slate-400/50 to-slate-300/50', icon: Crown }
};

const VIPLoyalty = ({ token, language = 'de' }) => {
  const [status, setStatus] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState('status'); // status, tiers, leaderboard

  const t = (key) => {
    const translations = {
      de: {
        title: 'VIP Treueprogramm',
        subtitle: 'Sammle Punkte und genieße exklusive Vorteile',
        yourStatus: 'Dein Status',
        points: 'Punkte',
        nextTier: 'Nächste Stufe',
        pointsNeeded: 'Punkte benötigt',
        benefits: 'Vorteile',
        cashbackBonus: 'Cashback Bonus',
        bidDiscount: 'Gebot-Rabatt',
        freeBidsMonthly: 'Gratis-Gebote/Monat',
        prioritySupport: 'Premium Support',
        exclusiveAuctions: 'Exklusive Auktionen',
        earlyAccess: 'Früher Zugang',
        claimDaily: 'Täglichen Bonus abholen',
        alreadyClaimed: 'Heute bereits abgeholt',
        memberSince: 'Mitglied seit',
        recentActivity: 'Letzte Aktivität',
        allTiers: 'Alle Stufen',
        leaderboard: 'Rangliste',
        thisWeek: 'Diese Woche',
        thisMonth: 'Diesen Monat',
        allTime: 'Gesamt',
        rank: 'Rang',
        howToEarn: 'So sammelst du Punkte',
        bidPlaced: 'Gebot platziert',
        auctionWon: 'Auktion gewonnen',
        bidPurchase: 'Gebote gekauft',
        dailyLogin: 'Täglicher Login',
        referralSignup: 'Freund geworben',
        current: 'Aktuell',
        topCollectors: 'Top Sammler diesen Monat',
        noLeaderboard: 'Noch keine Rangliste verfügbar'
      },
      en: {
        title: 'VIP Loyalty Program',
        subtitle: 'Earn points and enjoy exclusive benefits',
        yourStatus: 'Your Status',
        points: 'Points',
        nextTier: 'Next Tier',
        pointsNeeded: 'Points needed',
        benefits: 'Benefits',
        cashbackBonus: 'Cashback Bonus',
        bidDiscount: 'Bid Discount',
        freeBidsMonthly: 'Free Bids/Month',
        prioritySupport: 'Priority Support',
        exclusiveAuctions: 'Exclusive Auctions',
        earlyAccess: 'Early Access',
        claimDaily: 'Claim Daily Bonus',
        alreadyClaimed: 'Already claimed today',
        memberSince: 'Member since',
        recentActivity: 'Recent Activity',
        allTiers: 'All Tiers',
        leaderboard: 'Leaderboard',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        allTime: 'All Time',
        rank: 'Rank',
        howToEarn: 'How to earn points',
        bidPlaced: 'Bid placed',
        auctionWon: 'Auction won',
        bidPurchase: 'Bids purchased',
        dailyLogin: 'Daily login',
        referralSignup: 'Friend referred',
        current: 'Current',
        topCollectors: 'Top Collectors This Month',
        noLeaderboard: 'No leaderboard available yet'
      },
      tr: {
        title: 'VIP Sadakat Programı',
        subtitle: 'Puan kazan ve özel avantajların tadını çıkar',
        yourStatus: 'Durumun',
        points: 'Puan',
        nextTier: 'Sonraki Seviye',
        pointsNeeded: 'Gereken puan',
        benefits: 'Avantajlar',
        cashbackBonus: 'Cashback Bonus',
        bidDiscount: 'Teklif İndirimi',
        freeBidsMonthly: 'Aylık Ücretsiz Teklifler',
        prioritySupport: 'Öncelikli Destek',
        exclusiveAuctions: 'Özel Açık Artırmalar',
        earlyAccess: 'Erken Erişim',
        claimDaily: 'Günlük Bonus Al',
        alreadyClaimed: 'Bugün zaten alındı',
        memberSince: 'Üyelik tarihi',
        recentActivity: 'Son Aktivite',
        allTiers: 'Tüm Seviyeler',
        leaderboard: 'Liderlik Tablosu',
        thisWeek: 'Bu Hafta',
        thisMonth: 'Bu Ay',
        allTime: 'Tüm Zamanlar',
        rank: 'Sıra',
        howToEarn: 'Nasıl puan kazanılır',
        bidPlaced: 'Teklif verildi',
        auctionWon: 'Açık artırma kazanıldı',
        bidPurchase: 'Teklifler satın alındı',
        dailyLogin: 'Günlük giriş',
        referralSignup: 'Arkadaş davet edildi',
        current: 'Mevcut',
        topCollectors: 'Bu Ayın En İyi Toplayıcıları',
        noLeaderboard: 'Henüz liderlik tablosu yok'
      },
      fr: {
        title: 'Programme Fidélité VIP',
        subtitle: 'Gagnez des points et profitez d\'avantages exclusifs',
        yourStatus: 'Votre Statut',
        points: 'Points',
        nextTier: 'Niveau suivant',
        pointsNeeded: 'Points requis',
        benefits: 'Avantages',
        cashbackBonus: 'Bonus Cashback',
        bidDiscount: 'Réduction Enchère',
        freeBidsMonthly: 'Enchères Gratuites/Mois',
        prioritySupport: 'Support Prioritaire',
        exclusiveAuctions: 'Enchères Exclusives',
        earlyAccess: 'Accès Anticipé',
        claimDaily: 'Récupérer le Bonus Quotidien',
        alreadyClaimed: 'Déjà récupéré aujourd\'hui',
        memberSince: 'Membre depuis',
        recentActivity: 'Activité Récente',
        allTiers: 'Tous les Niveaux',
        leaderboard: 'Classement',
        thisWeek: 'Cette Semaine',
        thisMonth: 'Ce Mois',
        allTime: 'Tout le Temps',
        rank: 'Rang',
        howToEarn: 'Comment gagner des points',
        bidPlaced: 'Enchère placée',
        auctionWon: 'Enchère gagnée',
        bidPurchase: 'Enchères achetées',
        dailyLogin: 'Connexion quotidienne',
        referralSignup: 'Ami parrainé',
        current: 'Actuel',
        topCollectors: 'Meilleurs Collecteurs Ce Mois',
        noLeaderboard: 'Pas encore de classement'
      },
      es: {
        title: 'Programa de Fidelidad VIP',
        subtitle: 'Gana puntos y disfruta de beneficios exclusivos',
        yourStatus: 'Tu Estado',
        points: 'Puntos',
        nextTier: 'Siguiente Nivel',
        pointsNeeded: 'Puntos necesarios',
        benefits: 'Beneficios',
        cashbackBonus: 'Bonus Cashback',
        bidDiscount: 'Descuento en Pujas',
        freeBidsMonthly: 'Pujas Gratis/Mes',
        prioritySupport: 'Soporte Prioritario',
        exclusiveAuctions: 'Subastas Exclusivas',
        earlyAccess: 'Acceso Anticipado',
        claimDaily: 'Reclamar Bonus Diario',
        alreadyClaimed: 'Ya reclamado hoy',
        memberSince: 'Miembro desde',
        recentActivity: 'Actividad Reciente',
        allTiers: 'Todos los Niveles',
        leaderboard: 'Clasificación',
        thisWeek: 'Esta Semana',
        thisMonth: 'Este Mes',
        allTime: 'Todo el Tiempo',
        rank: 'Rango',
        howToEarn: 'Cómo ganar puntos',
        bidPlaced: 'Puja realizada',
        auctionWon: 'Subasta ganada',
        bidPurchase: 'Pujas compradas',
        dailyLogin: 'Inicio de sesión diario',
        referralSignup: 'Amigo referido',
        current: 'Actual',
        topCollectors: 'Mejores Colectores Este Mes',
        noLeaderboard: 'Clasificación aún no disponible'
      },
      ar: {
        title: 'برنامج ولاء VIP',
        subtitle: 'اجمع النقاط واستمتع بمزايا حصرية',
        yourStatus: 'حالتك',
        points: 'نقاط',
        nextTier: 'المستوى التالي',
        pointsNeeded: 'النقاط المطلوبة',
        benefits: 'المزايا',
        cashbackBonus: 'مكافأة استرداد نقدي',
        bidDiscount: 'خصم المزايدة',
        freeBidsMonthly: 'مزايدات مجانية/شهر',
        prioritySupport: 'دعم أولوية',
        exclusiveAuctions: 'مزادات حصرية',
        earlyAccess: 'وصول مبكر',
        claimDaily: 'احصل على المكافأة اليومية',
        alreadyClaimed: 'تم الحصول عليها اليوم',
        memberSince: 'عضو منذ',
        recentActivity: 'النشاط الأخير',
        allTiers: 'جميع المستويات',
        leaderboard: 'لوحة المتصدرين',
        thisWeek: 'هذا الأسبوع',
        thisMonth: 'هذا الشهر',
        allTime: 'كل الوقت',
        rank: 'الترتيب',
        howToEarn: 'كيف تكسب النقاط',
        bidPlaced: 'مزايدة مقدمة',
        auctionWon: 'مزاد مربوح',
        bidPurchase: 'مزايدات مشتراة',
        dailyLogin: 'تسجيل دخول يومي',
        referralSignup: 'صديق محال',
        current: 'الحالي',
        topCollectors: 'أفضل الجامعين هذا الشهر',
        noLeaderboard: 'لا توجد لوحة متصدرين بعد'
      },
      it: {
        title: 'Programma Fedeltà VIP',
        subtitle: 'Guadagna punti e goditi vantaggi esclusivi',
        yourStatus: 'Il Tuo Stato',
        points: 'Punti',
        nextTier: 'Prossimo Livello',
        pointsNeeded: 'Punti necessari',
        benefits: 'Vantaggi',
        cashbackBonus: 'Bonus Cashback',
        bidDiscount: 'Sconto Offerta',
        freeBidsMonthly: 'Offerte Gratuite/Mese',
        prioritySupport: 'Supporto Prioritario',
        exclusiveAuctions: 'Aste Esclusive',
        earlyAccess: 'Accesso Anticipato',
        claimDaily: 'Richiedi Bonus Giornaliero',
        alreadyClaimed: 'Già richiesto oggi',
        memberSince: 'Membro dal',
        recentActivity: 'Attività Recente',
        allTiers: 'Tutti i Livelli',
        leaderboard: 'Classifica',
        thisWeek: 'Questa Settimana',
        thisMonth: 'Questo Mese',
        allTime: 'Tutto il Tempo',
        rank: 'Posizione',
        howToEarn: 'Come guadagnare punti',
        bidPlaced: 'Offerta piazzata',
        auctionWon: 'Asta vinta',
        bidPurchase: 'Offerte acquistate',
        dailyLogin: 'Accesso giornaliero',
        referralSignup: 'Amico invitato',
        current: 'Attuale',
        topCollectors: 'Migliori Collezionisti Questo Mese',
        noLeaderboard: 'Classifica non ancora disponibile'
      },
      pt: {
        title: 'Programa de Fidelidade VIP',
        subtitle: 'Ganhe pontos e aproveite benefícios exclusivos',
        yourStatus: 'Seu Status',
        points: 'Pontos',
        nextTier: 'Próximo Nível',
        pointsNeeded: 'Pontos necessários',
        benefits: 'Benefícios',
        cashbackBonus: 'Bônus Cashback',
        bidDiscount: 'Desconto em Lances',
        freeBidsMonthly: 'Lances Grátis/Mês',
        prioritySupport: 'Suporte Prioritário',
        exclusiveAuctions: 'Leilões Exclusivos',
        earlyAccess: 'Acesso Antecipado',
        claimDaily: 'Resgatar Bônus Diário',
        alreadyClaimed: 'Já resgatado hoje',
        memberSince: 'Membro desde',
        recentActivity: 'Atividade Recente',
        allTiers: 'Todos os Níveis',
        leaderboard: 'Classificação',
        thisWeek: 'Esta Semana',
        thisMonth: 'Este Mês',
        allTime: 'Todo o Tempo',
        rank: 'Posição',
        howToEarn: 'Como ganhar pontos',
        bidPlaced: 'Lance feito',
        auctionWon: 'Leilão vencido',
        bidPurchase: 'Lances comprados',
        dailyLogin: 'Login diário',
        referralSignup: 'Amigo indicado',
        current: 'Atual',
        topCollectors: 'Melhores Colecionadores Este Mês',
        noLeaderboard: 'Classificação ainda não disponível'
      },
      nl: {
        title: 'VIP Loyaliteitsprogramma',
        subtitle: 'Verdien punten en geniet van exclusieve voordelen',
        yourStatus: 'Jouw Status',
        points: 'Punten',
        nextTier: 'Volgende Niveau',
        pointsNeeded: 'Punten nodig',
        benefits: 'Voordelen',
        cashbackBonus: 'Cashback Bonus',
        bidDiscount: 'Biedkorting',
        freeBidsMonthly: 'Gratis Biedingen/Maand',
        prioritySupport: 'Prioriteitsondersteuning',
        exclusiveAuctions: 'Exclusieve Veilingen',
        earlyAccess: 'Vroege Toegang',
        claimDaily: 'Dagelijkse Bonus Ophalen',
        alreadyClaimed: 'Vandaag al opgehaald',
        memberSince: 'Lid sinds',
        recentActivity: 'Recente Activiteit',
        allTiers: 'Alle Niveaus',
        leaderboard: 'Ranglijst',
        thisWeek: 'Deze Week',
        thisMonth: 'Deze Maand',
        allTime: 'Altijd',
        rank: 'Rang',
        howToEarn: 'Hoe punten verdienen',
        bidPlaced: 'Bod geplaatst',
        auctionWon: 'Veiling gewonnen',
        bidPurchase: 'Biedingen gekocht',
        dailyLogin: 'Dagelijkse login',
        referralSignup: 'Vriend doorverwezen',
        current: 'Huidig',
        topCollectors: 'Top Verzamelaars Deze Maand',
        noLeaderboard: 'Nog geen ranglijst beschikbaar'
      },
      pl: {
        title: 'Program Lojalnościowy VIP',
        subtitle: 'Zbieraj punkty i ciesz się ekskluzywnymi korzyściami',
        yourStatus: 'Twój Status',
        points: 'Punkty',
        nextTier: 'Następny Poziom',
        pointsNeeded: 'Potrzebne punkty',
        benefits: 'Korzyści',
        cashbackBonus: 'Bonus Cashback',
        bidDiscount: 'Zniżka na Licytacje',
        freeBidsMonthly: 'Darmowe Licytacje/Miesiąc',
        prioritySupport: 'Priorytetowe Wsparcie',
        exclusiveAuctions: 'Ekskluzywne Aukcje',
        earlyAccess: 'Wczesny Dostęp',
        claimDaily: 'Odbierz Dzienny Bonus',
        alreadyClaimed: 'Już odebrano dziś',
        memberSince: 'Członek od',
        recentActivity: 'Ostatnia Aktywność',
        allTiers: 'Wszystkie Poziomy',
        leaderboard: 'Ranking',
        thisWeek: 'Ten Tydzień',
        thisMonth: 'Ten Miesiąc',
        allTime: 'Cały Czas',
        rank: 'Pozycja',
        howToEarn: 'Jak zdobywać punkty',
        bidPlaced: 'Licytacja złożona',
        auctionWon: 'Aukcja wygrana',
        bidPurchase: 'Licytacje kupione',
        dailyLogin: 'Codzienne logowanie',
        referralSignup: 'Polecony znajomy',
        current: 'Aktualny',
        topCollectors: 'Najlepsi Kolekcjonerzy Tego Miesiąca',
        noLeaderboard: 'Ranking jeszcze niedostępny'
      },
      ru: {
        title: 'VIP Программа Лояльности',
        subtitle: 'Зарабатывайте баллы и пользуйтесь эксклюзивными преимуществами',
        yourStatus: 'Ваш Статус',
        points: 'Баллы',
        nextTier: 'Следующий Уровень',
        pointsNeeded: 'Требуется баллов',
        benefits: 'Преимущества',
        cashbackBonus: 'Кэшбэк Бонус',
        bidDiscount: 'Скидка на Ставки',
        freeBidsMonthly: 'Бесплатные Ставки/Месяц',
        prioritySupport: 'Приоритетная Поддержка',
        exclusiveAuctions: 'Эксклюзивные Аукционы',
        earlyAccess: 'Ранний Доступ',
        claimDaily: 'Получить Ежедневный Бонус',
        alreadyClaimed: 'Уже получено сегодня',
        memberSince: 'Участник с',
        recentActivity: 'Недавняя Активность',
        allTiers: 'Все Уровни',
        leaderboard: 'Таблица Лидеров',
        thisWeek: 'Эта Неделя',
        thisMonth: 'Этот Месяц',
        allTime: 'Всё Время',
        rank: 'Ранг',
        howToEarn: 'Как заработать баллы',
        bidPlaced: 'Ставка сделана',
        auctionWon: 'Аукцион выигран',
        bidPurchase: 'Ставки куплены',
        dailyLogin: 'Ежедневный вход',
        referralSignup: 'Приглашённый друг',
        current: 'Текущий',
        topCollectors: 'Лучшие Коллекционеры Месяца',
        noLeaderboard: 'Таблица лидеров пока недоступна'
      },
      zh: {
        title: 'VIP忠诚计划',
        subtitle: '赚取积分，享受专属优惠',
        yourStatus: '您的状态',
        points: '积分',
        nextTier: '下一等级',
        pointsNeeded: '所需积分',
        benefits: '优惠',
        cashbackBonus: '返现奖励',
        bidDiscount: '出价折扣',
        freeBidsMonthly: '每月免费出价',
        prioritySupport: '优先支持',
        exclusiveAuctions: '专属拍卖',
        earlyAccess: '提前访问',
        claimDaily: '领取每日奖励',
        alreadyClaimed: '今天已领取',
        memberSince: '会员自',
        recentActivity: '最近活动',
        allTiers: '所有等级',
        leaderboard: '排行榜',
        thisWeek: '本周',
        thisMonth: '本月',
        allTime: '所有时间',
        rank: '排名',
        howToEarn: '如何赚取积分',
        bidPlaced: '已出价',
        auctionWon: '拍卖获胜',
        bidPurchase: '购买出价',
        dailyLogin: '每日登录',
        referralSignup: '邀请好友',
        current: '当前',
        topCollectors: '本月最佳收藏家',
        noLeaderboard: '排行榜暂不可用'
      },
      ja: {
        title: 'VIPロイヤリティプログラム',
        subtitle: 'ポイントを貯めて特典を楽しもう',
        yourStatus: 'あなたのステータス',
        points: 'ポイント',
        nextTier: '次のレベル',
        pointsNeeded: '必要ポイント',
        benefits: '特典',
        cashbackBonus: 'キャッシュバックボーナス',
        bidDiscount: '入札割引',
        freeBidsMonthly: '月間無料入札',
        prioritySupport: '優先サポート',
        exclusiveAuctions: '限定オークション',
        earlyAccess: '早期アクセス',
        claimDaily: 'デイリーボーナスを獲得',
        alreadyClaimed: '本日は獲得済み',
        memberSince: '会員登録日',
        recentActivity: '最近のアクティビティ',
        allTiers: 'すべてのレベル',
        leaderboard: 'リーダーボード',
        thisWeek: '今週',
        thisMonth: '今月',
        allTime: '累計',
        rank: 'ランク',
        howToEarn: 'ポイントの貯め方',
        bidPlaced: '入札完了',
        auctionWon: 'オークション落札',
        bidPurchase: '入札購入',
        dailyLogin: '毎日ログイン',
        referralSignup: '友達紹介',
        current: '現在',
        topCollectors: '今月のトップコレクター',
        noLeaderboard: 'リーダーボードはまだありません'
      },
      ko: {
        title: 'VIP 로열티 프로그램',
        subtitle: '포인트를 적립하고 독점 혜택을 누리세요',
        yourStatus: '내 상태',
        points: '포인트',
        nextTier: '다음 등급',
        pointsNeeded: '필요 포인트',
        benefits: '혜택',
        cashbackBonus: '캐시백 보너스',
        bidDiscount: '입찰 할인',
        freeBidsMonthly: '월간 무료 입찰',
        prioritySupport: '우선 지원',
        exclusiveAuctions: '독점 경매',
        earlyAccess: '조기 접근',
        claimDaily: '일일 보너스 받기',
        alreadyClaimed: '오늘 이미 받음',
        memberSince: '가입일',
        recentActivity: '최근 활동',
        allTiers: '모든 등급',
        leaderboard: '리더보드',
        thisWeek: '이번 주',
        thisMonth: '이번 달',
        allTime: '전체',
        rank: '순위',
        howToEarn: '포인트 적립 방법',
        bidPlaced: '입찰 완료',
        auctionWon: '경매 낙찰',
        bidPurchase: '입찰 구매',
        dailyLogin: '일일 로그인',
        referralSignup: '친구 추천',
        current: '현재',
        topCollectors: '이번 달 최고 수집가',
        noLeaderboard: '리더보드가 아직 없습니다'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const [statusRes, tiersRes, leaderboardRes] = await Promise.all([
        fetch(`${API}/api/vip-loyalty/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/vip-loyalty/tiers`),
        fetch(`${API}/api/vip-loyalty/leaderboard?period=month`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }
      
      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(data.tiers || []);
      }
      
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const claimDailyBonus = async () => {
    setClaiming(true);
    try {
      const response = await fetch(`${API}/api/vip-loyalty/claim-daily`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`+${data.points_earned} Punkte erhalten!`);
        fetchData(); // Refresh status
      } else {
        toast.info(data.detail || t('alreadyClaimed'));
      }
    } catch (error) {
      toast.error('Fehler beim Abholen');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const currentTier = status?.tier || { id: 'bronze', name: 'Bronze', color: '#CD7F32', benefits: {} };
  const tierConfig = TIER_CONFIG[currentTier.id] || TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4" data-testid="vip-loyalty-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <Crown className="w-8 h-8 text-amber-500" />
            {t('title')}
          </h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-6">
          {['status', 'tiers', 'leaderboard'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab === 'status' ? t('yourStatus') : tab === 'tiers' ? t('allTiers') : t('leaderboard')}
            </button>
          ))}
        </div>

        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            {/* Current Status Card */}
            <div className={`bg-gradient-to-r ${tierConfig.bgColor} rounded-2xl p-6 border-2`} style={{ borderColor: currentTier.color }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: currentTier.color + '30' }}
                  >
                    <TierIcon className="w-8 h-8" style={{ color: currentTier.color }} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">{t('yourStatus')}</p>
                    <h2 className="text-2xl font-bold" style={{ color: currentTier.color }}>
                      {currentTier.name}
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">{t('points')}</p>
                  <p className="text-3xl font-bold text-amber-400">{status?.points?.toLocaleString('de-DE') || 0}</p>
                </div>
              </div>

              {/* Progress to Next Tier */}
              {status?.progress && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">{t('nextTier')}: {status.progress.next_tier_name}</span>
                    <span className="text-amber-400">{status.progress.points_needed} {t('pointsNeeded')}</span>
                  </div>
                  <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
                      style={{ width: `${status.progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Daily Bonus Button */}
              <Button
                onClick={claimDailyBonus}
                disabled={claiming}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                {claiming ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Gift className="w-4 h-4 mr-2" />
                )}
                {t('claimDaily')} (+5 Punkte)
              </Button>
            </div>

            {/* Benefits Grid */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                {t('benefits')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <BenefitItem
                  icon={Percent}
                  label={t('cashbackBonus')}
                  value={`+${currentTier.benefits?.cashback_bonus || 0}%`}
                  active={currentTier.benefits?.cashback_bonus > 0}
                />
                <BenefitItem
                  icon={Zap}
                  label={t('bidDiscount')}
                  value={`${currentTier.benefits?.bid_discount || 0}%`}
                  active={currentTier.benefits?.bid_discount > 0}
                />
                <BenefitItem
                  icon={Gift}
                  label={t('freeBidsMonthly')}
                  value={currentTier.benefits?.free_bids_monthly || 0}
                  active={currentTier.benefits?.free_bids_monthly > 0}
                />
                <BenefitItem
                  icon={Users}
                  label={t('prioritySupport')}
                  value={currentTier.benefits?.priority_support ? '✓' : '—'}
                  active={currentTier.benefits?.priority_support}
                />
                <BenefitItem
                  icon={Star}
                  label={t('exclusiveAuctions')}
                  value={currentTier.benefits?.exclusive_auctions ? '✓' : '—'}
                  active={currentTier.benefits?.exclusive_auctions}
                />
                <BenefitItem
                  icon={Clock}
                  label={t('earlyAccess')}
                  value={currentTier.benefits?.early_access ? '✓' : '—'}
                  active={currentTier.benefits?.early_access}
                />
              </div>
            </div>

            {/* How to Earn Points */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                {t('howToEarn')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <PointsMethod action={t('bidPlaced')} points={1} />
                <PointsMethod action={t('auctionWon')} points={100} />
                <PointsMethod action={t('bidPurchase')} points={2} />
                <PointsMethod action={t('dailyLogin')} points={5} />
                <PointsMethod action={t('referralSignup')} points={200} />
              </div>
            </div>

            {/* Recent Activity */}
            {status?.recent_activity && status.recent_activity.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
                <h3 className="text-lg font-semibold mb-4">{t('recentActivity')}</h3>
                <div className="space-y-3">
                  {status.recent_activity.map((activity, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{activity.reason}</span>
                      <span className={`font-medium ${activity.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {activity.points > 0 ? '+' : ''}{activity.points} Punkte
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tiers Tab */}
        {activeTab === 'tiers' && (
          <div className="space-y-4">
            {tiers.map((tier, idx) => {
              const config = TIER_CONFIG[tier.id] || TIER_CONFIG.bronze;
              const TIcon = config.icon;
              const isCurrentTier = tier.id === currentTier.id;
              const isUnlocked = (status?.points || 0) >= tier.min_points;
              
              return (
                <div 
                  key={tier.id}
                  className={`rounded-xl p-5 border-2 transition-all ${
                    isCurrentTier ? 'border-amber-500' : 'border-gray-700/50'
                  } ${isUnlocked ? '' : 'opacity-60'}`}
                  style={{ backgroundColor: config.color + '10' }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: config.color + '30' }}
                    >
                      {isUnlocked ? (
                        <TIcon className="w-7 h-7" style={{ color: config.color }} />
                      ) : (
                        <Lock className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold" style={{ color: config.color }}>
                          {tier.name}
                        </h3>
                        {isCurrentTier && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                            Aktuell
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{tier.min_points.toLocaleString('de-DE')} Punkte benötigt</p>
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-amber-400">+{tier.benefits?.cashback_bonus || 0}% Cashback</div>
                      <div className="text-gray-400">{tier.benefits?.free_bids_monthly || 0} Gratis-Gebote</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Top Sammler diesen Monat
              </h3>
            </div>
            <div className="divide-y divide-gray-700/50">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Noch keine Rangliste verfügbar
                </div>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 hover:bg-gray-700/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-black' :
                      idx === 1 ? 'bg-gray-400 text-black' :
                      idx === 2 ? 'bg-amber-700 text-white' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{entry.name}</p>
                      <p className="text-xs" style={{ color: TIER_CONFIG[entry.tier]?.color || '#CD7F32' }}>
                        {entry.tier?.charAt(0).toUpperCase() + entry.tier?.slice(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-bold">{entry.points?.toLocaleString('de-DE')}</p>
                      <p className="text-gray-500 text-xs">{t('points')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Benefit Item Component
const BenefitItem = ({ icon: Icon, label, value, active }) => (
  <div className={`p-3 rounded-lg ${active ? 'bg-amber-500/10' : 'bg-gray-700/30'}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-gray-500'}`} />
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
    <p className={`font-semibold ${active ? 'text-white' : 'text-gray-500'}`}>{value}</p>
  </div>
);

// Points Method Component
const PointsMethod = ({ action, points }) => (
  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
    <span className="text-gray-300 text-sm">{action}</span>
    <span className="text-amber-400 font-medium">+{points}</span>
  </div>
);

export default VIPLoyalty;
