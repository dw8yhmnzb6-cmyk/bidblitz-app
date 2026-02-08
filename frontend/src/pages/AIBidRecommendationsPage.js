import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Brain, TrendingUp, Target, Clock, 
  Zap, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Users, Timer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'KI Bid-Empfehlungen',
    subtitle: 'Smarte Gebots-Strategien basierend auf Echtzeit-Analyse',
    bestOpportunities: 'Beste Chancen für dich',
    winProbability: 'Gewinnchance',
    currentPrice: 'Aktueller Preis',
    timeLeft: 'Verbleibend',
    competition: 'Konkurrenz',
    recommendation: 'Empfehlung',
    bidNow: 'Jetzt bieten',
    wait: 'Warten',
    skip: 'Überspringen',
    confidence: 'Konfidenz',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    bidders: 'Bieter',
    avgInterval: 'Ø Intervall',
    seconds: 'Sek',
    strategy: 'Strategie',
    loading: 'Analysiere Auktionen...',
    noOpportunities: 'Keine passenden Auktionen gefunden',
    refresh: 'Aktualisieren',
    urgency: { critical: '🔥 JETZT!', high: '⚡ Schnell handeln', medium: '✅ Gute Chance', low: '⏳ Abwarten', none: '⚠️ Hohe Konkurrenz' }
  },
  en: {
    title: 'AI Bid Recommendations',
    subtitle: 'Smart bidding strategies based on real-time analysis',
    bestOpportunities: 'Best opportunities for you',
    winProbability: 'Win Probability',
    currentPrice: 'Current Price',
    timeLeft: 'Time Left',
    competition: 'Competition',
    recommendation: 'Recommendation',
    bidNow: 'Bid Now',
    wait: 'Wait',
    skip: 'Skip',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    bidders: 'Bidders',
    avgInterval: 'Avg Interval',
    seconds: 'sec',
    strategy: 'Strategy',
    loading: 'Analyzing auctions...',
    noOpportunities: 'No suitable auctions found',
    refresh: 'Refresh',
    urgency: { critical: '🔥 NOW!', high: '⚡ Act fast', medium: '✅ Good chance', low: '⏳ Wait', none: '⚠️ High competition' }
  },
  us: {
    title: 'AI Bid Recommendations',
    subtitle: 'Smart bidding strategies based on real-time analysis',
    bestOpportunities: 'Best opportunities for you',
    winProbability: 'Win Probability',
    currentPrice: 'Current Price',
    timeLeft: 'Time Left',
    competition: 'Competition',
    recommendation: 'Recommendation',
    bidNow: 'Bid Now',
    wait: 'Wait',
    skip: 'Skip',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    bidders: 'Bidders',
    avgInterval: 'Avg Interval',
    seconds: 'sec',
    strategy: 'Strategy',
    loading: 'Analyzing auctions...',
    noOpportunities: 'No suitable auctions found',
    refresh: 'Refresh',
    urgency: { critical: '🔥 NOW!', high: '⚡ Act fast', medium: '✅ Good chance', low: '⏳ Wait', none: '⚠️ High competition' }
  },
  fr: {
    title: 'Recommandations IA',
    subtitle: 'Stratégies d\'enchères intelligentes basées sur l\'analyse en temps réel',
    bestOpportunities: 'Meilleures opportunités pour vous',
    winProbability: 'Probabilité de gain',
    currentPrice: 'Prix actuel',
    timeLeft: 'Temps restant',
    competition: 'Concurrence',
    recommendation: 'Recommandation',
    bidNow: 'Enchérir',
    wait: 'Attendre',
    skip: 'Ignorer',
    confidence: 'Confiance',
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
    bidders: 'Enchérisseurs',
    avgInterval: 'Intervalle moy.',
    seconds: 'sec',
    strategy: 'Stratégie',
    loading: 'Analyse des enchères...',
    noOpportunities: 'Aucune enchère appropriée trouvée',
    refresh: 'Actualiser',
    urgency: { critical: '🔥 MAINTENANT!', high: '⚡ Agir vite', medium: '✅ Bonne chance', low: '⏳ Attendre', none: '⚠️ Forte concurrence' }
  },
  es: {
    title: 'Recomendaciones IA',
    subtitle: 'Estrategias de puja inteligentes basadas en análisis en tiempo real',
    bestOpportunities: 'Mejores oportunidades para ti',
    winProbability: 'Probabilidad de ganar',
    currentPrice: 'Precio actual',
    timeLeft: 'Tiempo restante',
    competition: 'Competencia',
    recommendation: 'Recomendación',
    bidNow: 'Pujar ahora',
    wait: 'Esperar',
    skip: 'Omitir',
    confidence: 'Confianza',
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
    bidders: 'Pujadores',
    avgInterval: 'Intervalo prom.',
    seconds: 'seg',
    strategy: 'Estrategia',
    loading: 'Analizando subastas...',
    noOpportunities: 'No se encontraron subastas adecuadas',
    refresh: 'Actualizar',
    urgency: { critical: '🔥 ¡AHORA!', high: '⚡ Actúa rápido', medium: '✅ Buena oportunidad', low: '⏳ Esperar', none: '⚠️ Alta competencia' }
  },
  it: {
    title: 'Raccomandazioni IA',
    subtitle: 'Strategie di offerta intelligenti basate su analisi in tempo reale',
    bestOpportunities: 'Migliori opportunità per te',
    winProbability: 'Probabilità di vincita',
    currentPrice: 'Prezzo attuale',
    timeLeft: 'Tempo rimanente',
    competition: 'Concorrenza',
    recommendation: 'Raccomandazione',
    bidNow: 'Offri ora',
    wait: 'Aspetta',
    skip: 'Salta',
    confidence: 'Affidabilità',
    high: 'Alta',
    medium: 'Media',
    low: 'Bassa',
    bidders: 'Offerenti',
    avgInterval: 'Intervallo medio',
    seconds: 'sec',
    strategy: 'Strategia',
    loading: 'Analisi delle aste...',
    noOpportunities: 'Nessuna asta adatta trovata',
    refresh: 'Aggiorna',
    urgency: { critical: '🔥 ORA!', high: '⚡ Agisci veloce', medium: '✅ Buona occasione', low: '⏳ Aspetta', none: '⚠️ Alta concorrenza' }
  },
  pt: {
    title: 'Recomendações IA',
    subtitle: 'Estratégias inteligentes baseadas em análise em tempo real',
    bestOpportunities: 'Melhores oportunidades para você',
    winProbability: 'Probabilidade de vitória',
    currentPrice: 'Preço atual',
    timeLeft: 'Tempo restante',
    competition: 'Concorrência',
    recommendation: 'Recomendação',
    bidNow: 'Ofertar agora',
    wait: 'Aguardar',
    skip: 'Pular',
    confidence: 'Confiança',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    bidders: 'Licitantes',
    avgInterval: 'Intervalo médio',
    seconds: 'seg',
    strategy: 'Estratégia',
    loading: 'Analisando leilões...',
    noOpportunities: 'Nenhum leilão adequado encontrado',
    refresh: 'Atualizar',
    urgency: { critical: '🔥 AGORA!', high: '⚡ Aja rápido', medium: '✅ Boa chance', low: '⏳ Aguarde', none: '⚠️ Alta concorrência' }
  },
  nl: {
    title: 'AI Bied-aanbevelingen',
    subtitle: 'Slimme biedstrategieën op basis van realtime analyse',
    bestOpportunities: 'Beste kansen voor jou',
    winProbability: 'Winkans',
    currentPrice: 'Huidige prijs',
    timeLeft: 'Tijd over',
    competition: 'Concurrentie',
    recommendation: 'Aanbeveling',
    bidNow: 'Nu bieden',
    wait: 'Wachten',
    skip: 'Overslaan',
    confidence: 'Vertrouwen',
    high: 'Hoog',
    medium: 'Gemiddeld',
    low: 'Laag',
    bidders: 'Bieders',
    avgInterval: 'Gem. interval',
    seconds: 'sec',
    strategy: 'Strategie',
    loading: 'Veilingen analyseren...',
    noOpportunities: 'Geen geschikte veilingen gevonden',
    refresh: 'Vernieuwen',
    urgency: { critical: '🔥 NU!', high: '⚡ Handel snel', medium: '✅ Goede kans', low: '⏳ Wachten', none: '⚠️ Hoge concurrentie' }
  },
  pl: {
    title: 'Rekomendacje AI',
    subtitle: 'Inteligentne strategie licytacji oparte na analizie w czasie rzeczywistym',
    bestOpportunities: 'Najlepsze okazje dla Ciebie',
    winProbability: 'Szansa na wygraną',
    currentPrice: 'Aktualna cena',
    timeLeft: 'Pozostało',
    competition: 'Konkurencja',
    recommendation: 'Rekomendacja',
    bidNow: 'Licytuj teraz',
    wait: 'Czekaj',
    skip: 'Pomiń',
    confidence: 'Pewność',
    high: 'Wysoka',
    medium: 'Średnia',
    low: 'Niska',
    bidders: 'Licytujący',
    avgInterval: 'Śr. interwał',
    seconds: 'sek',
    strategy: 'Strategia',
    loading: 'Analizowanie aukcji...',
    noOpportunities: 'Nie znaleziono odpowiednich aukcji',
    refresh: 'Odśwież',
    urgency: { critical: '🔥 TERAZ!', high: '⚡ Działaj szybko', medium: '✅ Dobra szansa', low: '⏳ Czekaj', none: '⚠️ Wysoka konkurencja' }
  },
  tr: {
    title: 'AI Teklif Önerileri',
    subtitle: 'Gerçek zamanlı analize dayalı akıllı teklif stratejileri',
    bestOpportunities: 'Sizin için en iyi fırsatlar',
    winProbability: 'Kazanma olasılığı',
    currentPrice: 'Mevcut fiyat',
    timeLeft: 'Kalan süre',
    competition: 'Rekabet',
    recommendation: 'Öneri',
    bidNow: 'Şimdi teklif ver',
    wait: 'Bekle',
    skip: 'Atla',
    confidence: 'Güven',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    bidders: 'Teklif verenler',
    avgInterval: 'Ort. aralık',
    seconds: 'san',
    strategy: 'Strateji',
    loading: 'Müzayedeler analiz ediliyor...',
    noOpportunities: 'Uygun müzayede bulunamadı',
    refresh: 'Yenile',
    urgency: { critical: '🔥 ŞİMDİ!', high: '⚡ Hızlı hareket et', medium: '✅ İyi şans', low: '⏳ Bekle', none: '⚠️ Yüksek rekabet' }
  },
  ru: {
    title: 'ИИ-рекомендации ставок',
    subtitle: 'Умные стратегии ставок на основе анализа в реальном времени',
    bestOpportunities: 'Лучшие возможности для вас',
    winProbability: 'Вероятность выигрыша',
    currentPrice: 'Текущая цена',
    timeLeft: 'Осталось',
    competition: 'Конкуренция',
    recommendation: 'Рекомендация',
    bidNow: 'Ставить сейчас',
    wait: 'Ждать',
    skip: 'Пропустить',
    confidence: 'Уверенность',
    high: 'Высокая',
    medium: 'Средняя',
    low: 'Низкая',
    bidders: 'Участники',
    avgInterval: 'Ср. интервал',
    seconds: 'сек',
    strategy: 'Стратегия',
    loading: 'Анализ аукционов...',
    noOpportunities: 'Подходящих аукционов не найдено',
    refresh: 'Обновить',
    urgency: { critical: '🔥 СЕЙЧАС!', high: '⚡ Действуй быстро', medium: '✅ Хороший шанс', low: '⏳ Подожди', none: '⚠️ Высокая конкуренция' }
  },
  ar: {
    title: 'توصيات الذكاء الاصطناعي',
    subtitle: 'استراتيجيات مزايدة ذكية بناءً على التحليل الفوري',
    bestOpportunities: 'أفضل الفرص لك',
    winProbability: 'احتمالية الفوز',
    currentPrice: 'السعر الحالي',
    timeLeft: 'الوقت المتبقي',
    competition: 'المنافسة',
    recommendation: 'التوصية',
    bidNow: 'زايد الآن',
    wait: 'انتظر',
    skip: 'تخطي',
    confidence: 'الثقة',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    bidders: 'المزايدون',
    avgInterval: 'متوسط الفاصل',
    seconds: 'ثانية',
    strategy: 'الاستراتيجية',
    loading: 'جاري تحليل المزادات...',
    noOpportunities: 'لم يتم العثور على مزادات مناسبة',
    refresh: 'تحديث',
    urgency: { critical: '🔥 الآن!', high: '⚡ تصرف بسرعة', medium: '✅ فرصة جيدة', low: '⏳ انتظر', none: '⚠️ منافسة عالية' }
  },
  ae: {
    title: 'توصيات الذكاء الاصطناعي',
    subtitle: 'استراتيجيات مزايدة ذكية بناءً على التحليل الفوري',
    bestOpportunities: 'أفضل الفرص لك',
    winProbability: 'احتمالية الفوز',
    currentPrice: 'السعر الحالي',
    timeLeft: 'الوقت المتبقي',
    competition: 'المنافسة',
    recommendation: 'التوصية',
    bidNow: 'زايد الآن',
    wait: 'انتظر',
    skip: 'تخطي',
    confidence: 'الثقة',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    bidders: 'المزايدون',
    avgInterval: 'متوسط الفاصل',
    seconds: 'ثانية',
    strategy: 'الاستراتيجية',
    loading: 'جاري تحليل المزادات...',
    noOpportunities: 'لم يتم العثور على مزادات مناسبة',
    refresh: 'تحديث',
    urgency: { critical: '🔥 الآن!', high: '⚡ تصرف بسرعة', medium: '✅ فرصة جيدة', low: '⏳ انتظر', none: '⚠️ منافسة عالية' }
  },
  zh: {
    title: 'AI竞拍建议',
    subtitle: '基于实时分析的智能竞拍策略',
    bestOpportunities: '最佳机会',
    winProbability: '获胜概率',
    currentPrice: '当前价格',
    timeLeft: '剩余时间',
    competition: '竞争',
    recommendation: '建议',
    bidNow: '立即竞拍',
    wait: '等待',
    skip: '跳过',
    confidence: '置信度',
    high: '高',
    medium: '中',
    low: '低',
    bidders: '竞拍者',
    avgInterval: '平均间隔',
    seconds: '秒',
    strategy: '策略',
    loading: '正在分析拍卖...',
    noOpportunities: '未找到合适的拍卖',
    refresh: '刷新',
    urgency: { critical: '🔥 现在!', high: '⚡ 快速行动', medium: '✅ 好机会', low: '⏳ 等待', none: '⚠️ 高竞争' }
  },
  ja: {
    title: 'AI入札レコメンド',
    subtitle: 'リアルタイム分析に基づくスマートな入札戦略',
    bestOpportunities: 'あなたへのベストチャンス',
    winProbability: '勝利確率',
    currentPrice: '現在価格',
    timeLeft: '残り時間',
    competition: '競争',
    recommendation: '推奨',
    bidNow: '今すぐ入札',
    wait: '待つ',
    skip: 'スキップ',
    confidence: '信頼度',
    high: '高',
    medium: '中',
    low: '低',
    bidders: '入札者',
    avgInterval: '平均間隔',
    seconds: '秒',
    strategy: '戦略',
    loading: 'オークションを分析中...',
    noOpportunities: '適切なオークションが見つかりません',
    refresh: '更新',
    urgency: { critical: '🔥 今すぐ!', high: '⚡ 早く行動', medium: '✅ 良いチャンス', low: '⏳ 待つ', none: '⚠️ 高競争' }
  },
  ko: {
    title: 'AI 입찰 추천',
    subtitle: '실시간 분석 기반 스마트 입찰 전략',
    bestOpportunities: '최고의 기회',
    winProbability: '당첨 확률',
    currentPrice: '현재 가격',
    timeLeft: '남은 시간',
    competition: '경쟁',
    recommendation: '추천',
    bidNow: '지금 입찰',
    wait: '대기',
    skip: '건너뛰기',
    confidence: '신뢰도',
    high: '높음',
    medium: '보통',
    low: '낮음',
    bidders: '입찰자',
    avgInterval: '평균 간격',
    seconds: '초',
    strategy: '전략',
    loading: '경매 분석 중...',
    noOpportunities: '적합한 경매를 찾을 수 없습니다',
    refresh: '새로고침',
    urgency: { critical: '🔥 지금!', high: '⚡ 빠르게 행동', medium: '✅ 좋은 기회', low: '⏳ 대기', none: '⚠️ 높은 경쟁' }
  },
  hi: {
    title: 'AI बोली अनुशंसाएं',
    subtitle: 'रियल-टाइम विश्लेषण पर आधारित स्मार्ट बोली रणनीतियां',
    bestOpportunities: 'आपके लिए सर्वोत्तम अवसर',
    winProbability: 'जीतने की संभावना',
    currentPrice: 'वर्तमान मूल्य',
    timeLeft: 'शेष समय',
    competition: 'प्रतिस्पर्धा',
    recommendation: 'अनुशंसा',
    bidNow: 'अभी बोली लगाएं',
    wait: 'प्रतीक्षा करें',
    skip: 'छोड़ें',
    confidence: 'विश्वास',
    high: 'उच्च',
    medium: 'मध्यम',
    low: 'कम',
    bidders: 'बोलीदाता',
    avgInterval: 'औसत अंतराल',
    seconds: 'सेकंड',
    strategy: 'रणनीति',
    loading: 'नीलामियों का विश्लेषण...',
    noOpportunities: 'कोई उपयुक्त नीलामी नहीं मिली',
    refresh: 'रिफ्रेश',
    urgency: { critical: '🔥 अभी!', high: '⚡ तेज़ी से करें', medium: '✅ अच्छा मौका', low: '⏳ प्रतीक्षा करें', none: '⚠️ उच्च प्रतिस्पर्धा' }
  },
  sq: {
    title: 'Rekomandimet AI për Oferta',
    subtitle: 'Strategji të zgjuara ofertash bazuar në analizë në kohë reale',
    bestOpportunities: 'Mundësitë më të mira për ty',
    winProbability: 'Mundësia për të fituar',
    currentPrice: 'Çmimi aktual',
    timeLeft: 'Koha e mbetur',
    competition: 'Konkurrenca',
    recommendation: 'Rekomandimi',
    bidNow: 'Oferoni tani',
    wait: 'Prisni',
    skip: 'Kaloni',
    confidence: 'Besueshmëria',
    high: 'E lartë',
    medium: 'Mesatare',
    low: 'E ulët',
    bidders: 'Ofertues',
    avgInterval: 'Intervali mesatar',
    seconds: 'sek',
    strategy: 'Strategjia',
    loading: 'Duke analizuar ankandet...',
    noOpportunities: 'Nuk u gjetën ankande të përshtatshme',
    refresh: 'Rifresko',
    urgency: { critical: '🔥 TANI!', high: '⚡ Vepro shpejt', medium: '✅ Mundësi e mirë', low: '⏳ Prit', none: '⚠️ Konkurrencë e lartë' }
  },
  xk: {
    title: 'Rekomandimet AI për Oferta',
    subtitle: 'Strategji të zgjuara ofertash bazuar në analizë në kohë reale',
    bestOpportunities: 'Mundësitë më të mira për ty',
    winProbability: 'Mundësia për të fituar',
    currentPrice: 'Çmimi aktual',
    timeLeft: 'Koha e mbetur',
    competition: 'Konkurrenca',
    recommendation: 'Rekomandimi',
    bidNow: 'Oferoni tani',
    wait: 'Prisni',
    skip: 'Kaloni',
    confidence: 'Besueshmëria',
    high: 'E lartë',
    medium: 'Mesatare',
    low: 'E ulët',
    bidders: 'Ofertues',
    avgInterval: 'Intervali mesatar',
    seconds: 'sek',
    strategy: 'Strategjia',
    loading: 'Duke analizuar ankandet...',
    noOpportunities: 'Nuk u gjetën ankande të përshtatshme',
    refresh: 'Rifresko',
    urgency: { critical: '🔥 TANI!', high: '⚡ Vepro shpejt', medium: '✅ Mundësi e mirë', low: '⏳ Prit', none: '⚠️ Konkurrencë e lartë' }
  },
  cs: {
    title: 'AI doporučení nabídek',
    subtitle: 'Chytré strategie nabídek založené na analýze v reálném čase',
    bestOpportunities: 'Nejlepší příležitosti pro vás',
    winProbability: 'Pravděpodobnost výhry',
    currentPrice: 'Aktuální cena',
    timeLeft: 'Zbývající čas',
    competition: 'Konkurence',
    recommendation: 'Doporučení',
    bidNow: 'Nabídnout nyní',
    wait: 'Počkat',
    skip: 'Přeskočit',
    confidence: 'Důvěra',
    high: 'Vysoká',
    medium: 'Střední',
    low: 'Nízká',
    bidders: 'Nabízející',
    avgInterval: 'Prům. interval',
    seconds: 'sek',
    strategy: 'Strategie',
    loading: 'Analyzuji aukce...',
    noOpportunities: 'Nenalezeny vhodné aukce',
    refresh: 'Obnovit',
    urgency: { critical: '🔥 TEĎ!', high: '⚡ Jednej rychle', medium: '✅ Dobrá šance', low: '⏳ Počkej', none: '⚠️ Vysoká konkurence' }
  },
  sv: {
    title: 'AI Budrekommendationer',
    subtitle: 'Smarta budstrategier baserade på realtidsanalys',
    bestOpportunities: 'Bästa möjligheterna för dig',
    winProbability: 'Vinstchans',
    currentPrice: 'Nuvarande pris',
    timeLeft: 'Tid kvar',
    competition: 'Konkurrens',
    recommendation: 'Rekommendation',
    bidNow: 'Buda nu',
    wait: 'Vänta',
    skip: 'Hoppa över',
    confidence: 'Säkerhet',
    high: 'Hög',
    medium: 'Medel',
    low: 'Låg',
    bidders: 'Budgivare',
    avgInterval: 'Snitt intervall',
    seconds: 'sek',
    strategy: 'Strategi',
    loading: 'Analyserar auktioner...',
    noOpportunities: 'Inga lämpliga auktioner hittades',
    refresh: 'Uppdatera',
    urgency: { critical: '🔥 NU!', high: '⚡ Agera snabbt', medium: '✅ Bra chans', low: '⏳ Vänta', none: '⚠️ Hög konkurrens' }
  },
  da: {
    title: 'AI Budanbefalinger',
    subtitle: 'Smarte budstrategier baseret på realtidsanalyse',
    bestOpportunities: 'Bedste muligheder for dig',
    winProbability: 'Vindechance',
    currentPrice: 'Nuværende pris',
    timeLeft: 'Tid tilbage',
    competition: 'Konkurrence',
    recommendation: 'Anbefaling',
    bidNow: 'Byd nu',
    wait: 'Vent',
    skip: 'Spring over',
    confidence: 'Sikkerhed',
    high: 'Høj',
    medium: 'Mellem',
    low: 'Lav',
    bidders: 'Bydere',
    avgInterval: 'Gns. interval',
    seconds: 'sek',
    strategy: 'Strategi',
    loading: 'Analyserer auktioner...',
    noOpportunities: 'Ingen passende auktioner fundet',
    refresh: 'Opdater',
    urgency: { critical: '🔥 NU!', high: '⚡ Handl hurtigt', medium: '✅ God chance', low: '⏳ Vent', none: '⚠️ Høj konkurrence' }
  },
  fi: {
    title: 'AI Tarjoussuositukset',
    subtitle: 'Älykkäät tarjousstrategiat reaaliaikaisen analyysin perusteella',
    bestOpportunities: 'Parhaat mahdollisuudet sinulle',
    winProbability: 'Voittomahdollisuus',
    currentPrice: 'Nykyinen hinta',
    timeLeft: 'Aikaa jäljellä',
    competition: 'Kilpailu',
    recommendation: 'Suositus',
    bidNow: 'Tarjoa nyt',
    wait: 'Odota',
    skip: 'Ohita',
    confidence: 'Luottamus',
    high: 'Korkea',
    medium: 'Keskitaso',
    low: 'Matala',
    bidders: 'Tarjoajat',
    avgInterval: 'Keskim. väli',
    seconds: 'sek',
    strategy: 'Strategia',
    loading: 'Analysoidaan huutokauppoja...',
    noOpportunities: 'Sopivia huutokauppoja ei löytynyt',
    refresh: 'Päivitä',
    urgency: { critical: '🔥 NYT!', high: '⚡ Toimi nopeasti', medium: '✅ Hyvä mahdollisuus', low: '⏳ Odota', none: '⚠️ Korkea kilpailu' }
  },
  el: {
    title: 'AI Συστάσεις Προσφορών',
    subtitle: 'Έξυπνες στρατηγικές προσφορών βασισμένες σε ανάλυση πραγματικού χρόνου',
    bestOpportunities: 'Καλύτερες ευκαιρίες για εσάς',
    winProbability: 'Πιθανότητα νίκης',
    currentPrice: 'Τρέχουσα τιμή',
    timeLeft: 'Χρόνος που απομένει',
    competition: 'Ανταγωνισμός',
    recommendation: 'Σύσταση',
    bidNow: 'Πλειοδοτήστε τώρα',
    wait: 'Περιμένετε',
    skip: 'Παράλειψη',
    confidence: 'Εμπιστοσύνη',
    high: 'Υψηλή',
    medium: 'Μέτρια',
    low: 'Χαμηλή',
    bidders: 'Πλειοδότες',
    avgInterval: 'Μέσο διάστημα',
    seconds: 'δευτ',
    strategy: 'Στρατηγική',
    loading: 'Ανάλυση δημοπρασιών...',
    noOpportunities: 'Δεν βρέθηκαν κατάλληλες δημοπρασίες',
    refresh: 'Ανανέωση',
    urgency: { critical: '🔥 ΤΩΡΑ!', high: '⚡ Δράσε γρήγορα', medium: '✅ Καλή ευκαιρία', low: '⏳ Περίμενε', none: '⚠️ Υψηλός ανταγωνισμός' }
  }
};

// Opportunity Card
const OpportunityCard = ({ opportunity, t, onBid }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(opportunity.seconds_left);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  
  const probability = opportunity.win_probability || 0;
  const isGoodChance = probability >= 50;
  
  return (
    <div 
      className={`bg-white rounded-xl border-2 shadow-lg ${
        probability >= 70 ? 'border-green-500' : 
        probability >= 50 ? 'border-cyan-500' : 
        'border-gray-200'
      } overflow-hidden hover:shadow-xl transition-all`}
    >
      {/* Header with probability */}
      <div className={`p-3 ${
        probability >= 70 ? 'bg-green-50' : 
        probability >= 50 ? 'bg-cyan-50' : 
        'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className={`w-5 h-5 ${probability >= 50 ? 'text-green-600' : 'text-gray-500'}`} />
            <span className={`font-bold ${probability >= 50 ? 'text-green-600' : 'text-gray-600'}`}>
              {probability}% {t.winProbability}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            opportunity.confidence === 'high' ? 'bg-green-100 text-green-700' :
            opportunity.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {t[opportunity.confidence] || opportunity.confidence}
          </span>
        </div>
        <Progress value={probability} className="h-1.5 mt-2" />
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          {/* Product Image */}
          <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer border border-gray-100"
               onClick={() => navigate(`/auctions/${opportunity.auction_id}`)}>
            {opportunity.product_image ? (
              <img 
                src={opportunity.product_image} 
                alt="" 
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <Target className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 
              className="text-gray-800 font-bold text-sm line-clamp-2 cursor-pointer hover:text-cyan-600"
              onClick={() => navigate(`/auctions/${opportunity.auction_id}`)}
            >
              {opportunity.product_name}
            </h3>
            <p className="text-gray-400 text-xs line-through">
              UVP: €{opportunity.retail_price?.toLocaleString('de-DE')}
            </p>
            <p className="text-amber-600 font-bold">
              €{opportunity.current_price?.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <Timer className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className="text-gray-800 text-sm font-bold">{formatTime(timeLeft)}</p>
            <p className="text-gray-500 text-[10px]">{t.timeLeft}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className="text-gray-800 text-sm font-bold">{opportunity.total_bids || 0}</p>
            <p className="text-gray-500 text-[10px]">{t.bidders}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <BarChart3 className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className={`text-sm font-bold ${isGoodChance ? 'text-green-600' : 'text-amber-600'}`}>
              {isGoodChance ? t.low : t.high}
            </p>
            <p className="text-gray-500 text-[10px]">{t.competition}</p>
          </div>
        </div>
        
        {/* Action Button */}
        <Button 
          onClick={() => onBid(opportunity.auction_id)}
          className={`w-full ${
            probability >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white' :
            probability >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white' :
            'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 mr-1" />
          {probability >= 50 ? t.bidNow : t.wait}
        </Button>
      </div>
    </div>
  );
};

export default function AIBidRecommendationsPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const navigate = useNavigate();
  const t = translations[mappedLanguage] || translations[langKey] || translations.de;
  
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchOpportunities = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/ai-bid/best-opportunities?limit=8`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpportunities(res.data.opportunities || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchOpportunities();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOpportunities, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);
  
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(
        `${API}/api/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot platziert!');
      fetchOpportunities(); // Refresh
    } catch (error) {
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Bitte anmelden um zu bieten');
        navigate('/login');
        return;
      }
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 shadow-lg border border-gray-200">
          <Brain className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <p className="text-gray-600">Bitte anmelden für KI-Empfehlungen</p>
          <Button onClick={() => navigate('/login')} className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
            Anmelden
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="ai-bid-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 border border-purple-200 mb-4">
            <Brain className="w-5 h-5 text-purple-600" />
            <span className="text-purple-600 font-bold">KI-POWERED</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-600 text-lg">{t.subtitle}</p>
        </div>
        
        {/* Refresh Button */}
        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={fetchOpportunities} disabled={loading} className="border-gray-300 text-gray-700 hover:bg-gray-50">
            {t.refresh}
          </Button>
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">{t.loading}</p>
            </div>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-gray-200">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl text-gray-800 mb-2">{t.noOpportunities}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {opportunities.map(opp => (
              <OpportunityCard 
                key={opp.auction_id} 
                opportunity={opp} 
                t={t} 
                onBid={handleBid}
              />
            ))}
          </div>
        )}
        
        {/* Info Box */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-purple-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Wie funktionieren die KI-Empfehlungen?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Analyse von Bieter-Mustern und Aktivitätsintensität</p>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Bewertung der Konkurrenz und deiner Gewinnhistorie</p>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Echtzeit-Berechnung der Gewinnwahrscheinlichkeit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
