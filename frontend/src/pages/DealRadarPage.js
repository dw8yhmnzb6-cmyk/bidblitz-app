import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Radar, Clock, TrendingDown, Activity, 
  AlertTriangle, Target, Zap, ArrowRight,
  RefreshCw, Bell, Settings
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations - All 6 languages
const translations = {
  de: {
    title: 'Schnäppchen-Radar',
    subtitle: 'Finde die besten Deals mit wenig Konkurrenz',
    bargains: 'Top Schnäppchen',
    lowActivity: 'Wenig Aktivität',
    endingSoon: 'Endet bald',
    priceHistory: 'Preishistorie',
    currentPrice: 'Aktuell',
    retailPrice: 'UVP',
    discount: 'Rabatt',
    bids: 'Gebote',
    timeLeft: 'Verbleibend',
    minutes: 'Min',
    seconds: 'Sek',
    lastBidder: 'Letzter Bieter',
    noOne: 'Noch niemand',
    bidNow: 'Jetzt bieten',
    view: 'Ansehen',
    refresh: 'Aktualisieren',
    lowActivityLabel: 'Wenig Gebote',
    endingSoonLabel: 'Endet bald',
    bargainScore: 'Deal-Score',
    settings: 'Einstellungen',
    avgPrice: 'Ø Preis',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'verkauft',
    noBargains: 'Keine Schnäppchen gefunden',
    noBargainsDesc: 'Aktuell gibt es keine Auktionen mit wenig Aktivität',
    checkBack: 'Schau später wieder vorbei!',
    loading: 'Suche nach Deals...',
    howItWorks: 'Wie funktioniert der Schnäppchen-Radar?',
    step1: 'Wir scannen alle aktiven Auktionen nach Deals mit wenig Konkurrenz',
    step2: 'Auktionen mit wenigen Geboten und kurzer Restzeit werden markiert',
    step3: 'Greife schnell zu - diese Deals verschwinden in Sekunden!'
  },
  en: {
    title: 'Deal Radar',
    subtitle: 'Find the best deals with low competition',
    bargains: 'Top Bargains',
    lowActivity: 'Low Activity',
    endingSoon: 'Ending Soon',
    priceHistory: 'Price History',
    currentPrice: 'Current',
    retailPrice: 'RRP',
    discount: 'Discount',
    bids: 'Bids',
    timeLeft: 'Time Left',
    minutes: 'min',
    seconds: 'sec',
    lastBidder: 'Last Bidder',
    noOne: 'No one yet',
    bidNow: 'Bid Now',
    view: 'View',
    refresh: 'Refresh',
    lowActivityLabel: 'Low Bids',
    endingSoonLabel: 'Ending Soon',
    bargainScore: 'Deal Score',
    settings: 'Settings',
    avgPrice: 'Avg Price',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'sold',
    noBargains: 'No bargains found',
    noBargainsDesc: 'Currently no auctions with low activity',
    checkBack: 'Check back later!',
    loading: 'Searching for deals...',
    howItWorks: 'How does the Deal Radar work?',
    step1: 'We scan all active auctions for deals with low competition',
    step2: 'Auctions with few bids and short remaining time are highlighted',
    step3: 'Act fast - these deals disappear in seconds!'
  },
  tr: {
    title: 'Fırsat Radarı',
    subtitle: 'Düşük rekabetli en iyi fırsatları bulun',
    bargains: 'En İyi Fırsatlar',
    lowActivity: 'Düşük Aktivite',
    endingSoon: 'Yakında Bitiyor',
    priceHistory: 'Fiyat Geçmişi',
    currentPrice: 'Mevcut',
    retailPrice: 'PBF',
    discount: 'İndirim',
    bids: 'Teklifler',
    timeLeft: 'Kalan Süre',
    minutes: 'dk',
    seconds: 'sn',
    lastBidder: 'Son Teklif Veren',
    noOne: 'Henüz kimse',
    bidNow: 'Şimdi Teklif Ver',
    view: 'Görüntüle',
    refresh: 'Yenile',
    lowActivityLabel: 'Az Teklif',
    endingSoonLabel: 'Yakında Bitiyor',
    bargainScore: 'Fırsat Puanı',
    settings: 'Ayarlar',
    avgPrice: 'Ort. Fiyat',
    minPrice: 'Min',
    maxPrice: 'Maks',
    soldTimes: 'satıldı',
    noBargains: 'Fırsat bulunamadı',
    noBargainsDesc: 'Şu anda düşük aktiviteli açık artırma yok',
    checkBack: 'Daha sonra tekrar kontrol edin!',
    loading: 'Fırsatlar aranıyor...',
    howItWorks: 'Fırsat Radarı nasıl çalışır?',
    step1: 'Düşük rekabetli fırsatlar için tüm aktif açık artırmaları tarıyoruz',
    step2: 'Az teklifli ve kısa süreli açık artırmalar işaretlenir',
    step3: 'Hızlı davranın - bu fırsatlar saniyeler içinde kaybolur!'
  },
  fr: {
    title: 'Radar des Bonnes Affaires',
    subtitle: 'Trouvez les meilleures offres avec peu de concurrence',
    bargains: 'Meilleures Affaires',
    lowActivity: 'Faible Activité',
    endingSoon: 'Se Termine Bientôt',
    priceHistory: 'Historique des Prix',
    currentPrice: 'Actuel',
    retailPrice: 'PVR',
    discount: 'Remise',
    bids: 'Enchères',
    timeLeft: 'Temps Restant',
    minutes: 'min',
    seconds: 'sec',
    lastBidder: 'Dernier Enchérisseur',
    noOne: 'Personne encore',
    bidNow: 'Enchérir',
    view: 'Voir',
    refresh: 'Actualiser',
    lowActivityLabel: 'Peu d\'Enchères',
    endingSoonLabel: 'Fin Proche',
    bargainScore: 'Score Affaire',
    settings: 'Paramètres',
    avgPrice: 'Prix Moy.',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'vendu',
    noBargains: 'Aucune bonne affaire trouvée',
    noBargainsDesc: 'Actuellement aucune enchère avec peu d\'activité',
    checkBack: 'Revenez plus tard!',
    loading: 'Recherche d\'offres...',
    howItWorks: 'Comment fonctionne le Radar des Bonnes Affaires?',
    step1: 'Nous analysons toutes les enchères actives pour les offres avec peu de concurrence',
    step2: 'Les enchères avec peu d\'offres et un temps restant court sont mises en évidence',
    step3: 'Agissez vite - ces offres disparaissent en quelques secondes!'
  },
  es: {
    title: 'Radar de Ofertas',
    subtitle: 'Encuentra las mejores ofertas con poca competencia',
    bargains: 'Mejores Ofertas',
    lowActivity: 'Baja Actividad',
    endingSoon: 'Termina Pronto',
    priceHistory: 'Historial de Precios',
    currentPrice: 'Actual',
    retailPrice: 'PVP',
    discount: 'Descuento',
    bids: 'Pujas',
    timeLeft: 'Tiempo Restante',
    minutes: 'min',
    seconds: 'seg',
    lastBidder: 'Último Postor',
    noOne: 'Nadie aún',
    bidNow: 'Pujar Ahora',
    view: 'Ver',
    refresh: 'Actualizar',
    lowActivityLabel: 'Pocas Pujas',
    endingSoonLabel: 'Termina Pronto',
    bargainScore: 'Puntuación',
    settings: 'Ajustes',
    avgPrice: 'Precio Med.',
    minPrice: 'Mín',
    maxPrice: 'Máx',
    soldTimes: 'vendido',
    noBargains: 'No se encontraron ofertas',
    noBargainsDesc: 'Actualmente no hay subastas con poca actividad',
    checkBack: '¡Vuelve más tarde!',
    loading: 'Buscando ofertas...',
    howItWorks: '¿Cómo funciona el Radar de Ofertas?',
    step1: 'Escaneamos todas las subastas activas en busca de ofertas con poca competencia',
    step2: 'Las subastas con pocas pujas y poco tiempo restante se destacan',
    step3: '¡Actúa rápido - estas ofertas desaparecen en segundos!'
  },
  sq: {
    title: 'Radari i Ofertave', subtitle: 'Gjeni ofertat më të mira me konkurrencë të ulët', bargains: 'Ofertat Top', lowActivity: 'Aktivitet i Ulët', endingSoon: 'Përfundon Së Shpejti', priceHistory: 'Historia e Çmimeve', currentPrice: 'Aktual', retailPrice: 'ÇSH', discount: 'Zbritje', bids: 'Oferta', timeLeft: 'Koha e Mbetur', minutes: 'min', seconds: 'sek', lastBidder: 'Ofertuesi i Fundit', noOne: 'Askush ende', bidNow: 'Ofertohu Tani', view: 'Shiko', refresh: 'Rifresko', lowActivityLabel: 'Pak Oferta', endingSoonLabel: 'Përfundon Së Shpejti', bargainScore: 'Pikët e Ofertës', settings: 'Cilësimet', avgPrice: 'Çmimi Mes.', minPrice: 'Min', maxPrice: 'Maks', soldTimes: 'shitur', noBargains: 'Nuk u gjetën oferta', noBargainsDesc: 'Aktualisht nuk ka ankande me aktivitet të ulët', checkBack: 'Kthehuni më vonë!', loading: 'Duke kërkuar oferta...', howItWorks: 'Si funksionon Radari i Ofertave?', step1: 'Ne skanojmë të gjitha ankandat aktive për oferta me konkurrencë të ulët', step2: 'Ankandat me pak oferta dhe kohë të shkurtër të mbetur theksohen', step3: 'Veproni shpejt - këto oferta zhduken brenda sekondave!'
  },
  xk: {
    title: 'Radari i Ofertave', subtitle: 'Gjeni ofertat më të mira me konkurrencë të ulët', bargains: 'Ofertat Top', lowActivity: 'Aktivitet i Ulët', endingSoon: 'Përfundon Së Shpejti', priceHistory: 'Historia e Çmimeve', currentPrice: 'Aktual', retailPrice: 'ÇSH', discount: 'Zbritje', bids: 'Oferta', timeLeft: 'Koha e Mbetur', minutes: 'min', seconds: 'sek', lastBidder: 'Ofertuesi i Fundit', noOne: 'Askush ende', bidNow: 'Ofertohu Tani', view: 'Shiko', refresh: 'Rifresko', lowActivityLabel: 'Pak Oferta', endingSoonLabel: 'Përfundon Së Shpejti', bargainScore: 'Pikët e Ofertës', settings: 'Cilësimet', avgPrice: 'Çmimi Mes.', minPrice: 'Min', maxPrice: 'Maks', soldTimes: 'shitur', noBargains: 'Nuk u gjetën oferta', noBargainsDesc: 'Aktualisht nuk ka ankande me aktivitet të ulët', checkBack: 'Kthehuni më vonë!', loading: 'Duke kërkuar oferta...', howItWorks: 'Si funksionon Radari i Ofertave?', step1: 'Ne skanojmë të gjitha ankandat aktive për oferta me konkurrencë të ulët', step2: 'Ankandat me pak oferta dhe kohë të shkurtër të mbetur theksohen', step3: 'Veproni shpejt - këto oferta zhduken brenda sekondave!'
  },
  us: {
    title: 'Deal Radar', subtitle: 'Find the best deals with low competition', bargains: 'Top Bargains', lowActivity: 'Low Activity', endingSoon: 'Ending Soon', priceHistory: 'Price History', currentPrice: 'Current', retailPrice: 'RRP', discount: 'Discount', bids: 'Bids', timeLeft: 'Time Left', minutes: 'min', seconds: 'sec', lastBidder: 'Last Bidder', noOne: 'No one yet', bidNow: 'Bid Now', view: 'View', refresh: 'Refresh', lowActivityLabel: 'Low Bids', endingSoonLabel: 'Ending Soon', bargainScore: 'Deal Score', settings: 'Settings', avgPrice: 'Avg Price', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'sold', noBargains: 'No bargains found', noBargainsDesc: 'Currently no auctions with low activity', checkBack: 'Check back later!', loading: 'Searching for deals...', howItWorks: 'How does the Deal Radar work?', step1: 'We scan all active auctions for deals with low competition', step2: 'Auctions with few bids and short remaining time are highlighted', step3: 'Act fast - these deals disappear in seconds!'
  },
  it: {
    title: 'Radar Offerte', subtitle: 'Trova le migliori offerte con poca concorrenza', bargains: 'Migliori Affari', lowActivity: 'Bassa Attività', endingSoon: 'Termina Presto', priceHistory: 'Storico Prezzi', currentPrice: 'Attuale', retailPrice: 'PVR', discount: 'Sconto', bids: 'Offerte', timeLeft: 'Tempo Rimanente', minutes: 'min', seconds: 'sec', lastBidder: 'Ultimo Offerente', noOne: 'Nessuno ancora', bidNow: 'Offri Ora', view: 'Vedi', refresh: 'Aggiorna', lowActivityLabel: 'Poche Offerte', endingSoonLabel: 'Termina Presto', bargainScore: 'Punteggio', settings: 'Impostazioni', avgPrice: 'Prezzo Med.', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'venduto', noBargains: 'Nessuna offerta trovata', noBargainsDesc: 'Attualmente nessuna asta con bassa attività', checkBack: 'Torna più tardi!', loading: 'Ricerca offerte...', howItWorks: 'Come funziona il Radar Offerte?', step1: 'Scansioniamo tutte le aste attive per offerte con poca concorrenza', step2: 'Le aste con poche offerte e tempo rimanente breve vengono evidenziate', step3: 'Agisci veloce - queste offerte scompaiono in secondi!'
  },
  pt: {
    title: 'Radar de Ofertas', subtitle: 'Encontre as melhores ofertas com pouca concorrência', bargains: 'Melhores Negócios', lowActivity: 'Baixa Atividade', endingSoon: 'Termina em Breve', priceHistory: 'Histórico de Preços', currentPrice: 'Atual', retailPrice: 'PVR', discount: 'Desconto', bids: 'Lances', timeLeft: 'Tempo Restante', minutes: 'min', seconds: 'seg', lastBidder: 'Último Licitante', noOne: 'Ninguém ainda', bidNow: 'Licitar Agora', view: 'Ver', refresh: 'Atualizar', lowActivityLabel: 'Poucos Lances', endingSoonLabel: 'Termina em Breve', bargainScore: 'Pontuação', settings: 'Configurações', avgPrice: 'Preço Méd.', minPrice: 'Mín', maxPrice: 'Máx', soldTimes: 'vendido', noBargains: 'Nenhuma oferta encontrada', noBargainsDesc: 'Atualmente não há leilões com baixa atividade', checkBack: 'Volte mais tarde!', loading: 'Procurando ofertas...', howItWorks: 'Como funciona o Radar de Ofertas?', step1: 'Escaneamos todos os leilões ativos em busca de ofertas com pouca concorrência', step2: 'Leilões com poucos lances e pouco tempo restante são destacados', step3: 'Aja rápido - essas ofertas desaparecem em segundos!'
  },
  nl: {
    title: 'Deal Radar', subtitle: 'Vind de beste deals met weinig concurrentie', bargains: 'Beste Koopjes', lowActivity: 'Lage Activiteit', endingSoon: 'Eindigt Snel', priceHistory: 'Prijsgeschiedenis', currentPrice: 'Huidig', retailPrice: 'AVP', discount: 'Korting', bids: 'Biedingen', timeLeft: 'Tijd Over', minutes: 'min', seconds: 'sec', lastBidder: 'Laatste Bieder', noOne: 'Nog niemand', bidNow: 'Nu Bieden', view: 'Bekijk', refresh: 'Vernieuwen', lowActivityLabel: 'Weinig Biedingen', endingSoonLabel: 'Eindigt Snel', bargainScore: 'Deal Score', settings: 'Instellingen', avgPrice: 'Gem. Prijs', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'verkocht', noBargains: 'Geen koopjes gevonden', noBargainsDesc: 'Momenteel geen veilingen met lage activiteit', checkBack: 'Kom later terug!', loading: 'Zoeken naar deals...', howItWorks: 'Hoe werkt de Deal Radar?', step1: 'We scannen alle actieve veilingen op deals met weinig concurrentie', step2: 'Veilingen met weinig biedingen en korte resterende tijd worden gemarkeerd', step3: 'Wees snel - deze deals verdwijnen binnen seconden!'
  },
  pl: {
    title: 'Radar Ofert', subtitle: 'Znajdź najlepsze oferty z niską konkurencją', bargains: 'Najlepsze Okazje', lowActivity: 'Niska Aktywność', endingSoon: 'Kończy się Wkrótce', priceHistory: 'Historia Cen', currentPrice: 'Aktualna', retailPrice: 'Cena det.', discount: 'Zniżka', bids: 'Oferty', timeLeft: 'Pozostało', minutes: 'min', seconds: 'sek', lastBidder: 'Ostatni Licytujący', noOne: 'Jeszcze nikt', bidNow: 'Licytuj Teraz', view: 'Zobacz', refresh: 'Odśwież', lowActivityLabel: 'Mało Ofert', endingSoonLabel: 'Kończy się Wkrótce', bargainScore: 'Ocena Oferty', settings: 'Ustawienia', avgPrice: 'Śr. Cena', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'sprzedano', noBargains: 'Nie znaleziono okazji', noBargainsDesc: 'Obecnie brak aukcji z niską aktywnością', checkBack: 'Wróć później!', loading: 'Szukanie ofert...', howItWorks: 'Jak działa Radar Ofert?', step1: 'Skanujemy wszystkie aktywne aukcje w poszukiwaniu ofert z niską konkurencją', step2: 'Aukcje z małą liczbą ofert i krótkim pozostałym czasem są wyróżniane', step3: 'Działaj szybko - te oferty znikają w sekundy!'
  },
  ru: {
    title: 'Радар Сделок', subtitle: 'Находите лучшие сделки с низкой конкуренцией', bargains: 'Лучшие Предложения', lowActivity: 'Низкая Активность', endingSoon: 'Скоро Заканчивается', priceHistory: 'История Цен', currentPrice: 'Текущая', retailPrice: 'РРЦ', discount: 'Скидка', bids: 'Ставки', timeLeft: 'Осталось', minutes: 'мин', seconds: 'сек', lastBidder: 'Последний Участник', noOne: 'Пока никого', bidNow: 'Ставить Сейчас', view: 'Смотреть', refresh: 'Обновить', lowActivityLabel: 'Мало Ставок', endingSoonLabel: 'Скоро Заканчивается', bargainScore: 'Оценка Сделки', settings: 'Настройки', avgPrice: 'Ср. Цена', minPrice: 'Мин', maxPrice: 'Макс', soldTimes: 'продано', noBargains: 'Сделки не найдены', noBargainsDesc: 'Сейчас нет аукционов с низкой активностью', checkBack: 'Зайдите позже!', loading: 'Поиск сделок...', howItWorks: 'Как работает Радар Сделок?', step1: 'Мы сканируем все активные аукционы для поиска сделок с низкой конкуренцией', step2: 'Аукционы с малым количеством ставок и коротким оставшимся временем выделяются', step3: 'Действуйте быстро - эти сделки исчезают за секунды!'
  },
  ar: {
    title: 'رادار الصفقات', subtitle: 'اعثر على أفضل الصفقات مع منافسة منخفضة', bargains: 'أفضل الصفقات', lowActivity: 'نشاط منخفض', endingSoon: 'ينتهي قريباً', priceHistory: 'تاريخ الأسعار', currentPrice: 'الحالي', retailPrice: 'السعر', discount: 'خصم', bids: 'العروض', timeLeft: 'الوقت المتبقي', minutes: 'دقيقة', seconds: 'ثانية', lastBidder: 'آخر مزايد', noOne: 'لا أحد بعد', bidNow: 'زايد الآن', view: 'عرض', refresh: 'تحديث', lowActivityLabel: 'عروض قليلة', endingSoonLabel: 'ينتهي قريباً', bargainScore: 'نقاط الصفقة', settings: 'الإعدادات', avgPrice: 'متوسط السعر', minPrice: 'أدنى', maxPrice: 'أقصى', soldTimes: 'بيعت', noBargains: 'لم يتم العثور على صفقات', noBargainsDesc: 'لا توجد مزادات بنشاط منخفض حالياً', checkBack: 'عد لاحقاً!', loading: 'البحث عن صفقات...', howItWorks: 'كيف يعمل رادار الصفقات؟', step1: 'نفحص جميع المزادات النشطة بحثاً عن صفقات بمنافسة منخفضة', step2: 'يتم تمييز المزادات ذات العروض القليلة والوقت القصير المتبقي', step3: 'تصرف بسرعة - هذه الصفقات تختفي في ثوانٍ!'
  },
  ae: {
    title: 'رادار الصفقات', subtitle: 'اعثر على أفضل الصفقات مع منافسة منخفضة', bargains: 'أفضل الصفقات', lowActivity: 'نشاط منخفض', endingSoon: 'ينتهي قريباً', priceHistory: 'تاريخ الأسعار', currentPrice: 'الحالي', retailPrice: 'السعر', discount: 'خصم', bids: 'العروض', timeLeft: 'الوقت المتبقي', minutes: 'دقيقة', seconds: 'ثانية', lastBidder: 'آخر مزايد', noOne: 'لا أحد بعد', bidNow: 'زايد الآن', view: 'عرض', refresh: 'تحديث', lowActivityLabel: 'عروض قليلة', endingSoonLabel: 'ينتهي قريباً', bargainScore: 'نقاط الصفقة', settings: 'الإعدادات', avgPrice: 'متوسط السعر', minPrice: 'أدنى', maxPrice: 'أقصى', soldTimes: 'بيعت', noBargains: 'لم يتم العثور على صفقات', noBargainsDesc: 'لا توجد مزادات بنشاط منخفض حالياً', checkBack: 'عد لاحقاً!', loading: 'البحث عن صفقات...', howItWorks: 'كيف يعمل رادار الصفقات؟', step1: 'نفحص جميع المزادات النشطة بحثاً عن صفقات بمنافسة منخفضة', step2: 'يتم تمييز المزادات ذات العروض القليلة والوقت القصير المتبقي', step3: 'تصرف بسرعة - هذه الصفقات تختفي في ثوانٍ!'
  },
  zh: {
    title: '优惠雷达', subtitle: '发现竞争少的最佳优惠', bargains: '最佳优惠', lowActivity: '低活跃度', endingSoon: '即将结束', priceHistory: '价格历史', currentPrice: '当前', retailPrice: '零售价', discount: '折扣', bids: '出价', timeLeft: '剩余时间', minutes: '分钟', seconds: '秒', lastBidder: '最后出价者', noOne: '暂无', bidNow: '立即出价', view: '查看', refresh: '刷新', lowActivityLabel: '出价少', endingSoonLabel: '即将结束', bargainScore: '优惠评分', settings: '设置', avgPrice: '平均价格', minPrice: '最低', maxPrice: '最高', soldTimes: '已售', noBargains: '未找到优惠', noBargainsDesc: '目前没有低活跃度的拍卖', checkBack: '稍后再来！', loading: '搜索优惠...', howItWorks: '优惠雷达如何工作？', step1: '我们扫描所有活跃拍卖以寻找竞争少的优惠', step2: '出价少且剩余时间短的拍卖会被标记', step3: '快速行动 - 这些优惠几秒钟内就会消失！'
  },
  ja: {
    title: 'ディールレーダー', subtitle: '競争の少ない最高の取引を見つける', bargains: 'ベストディール', lowActivity: '低活動', endingSoon: '間もなく終了', priceHistory: '価格履歴', currentPrice: '現在', retailPrice: '小売価格', discount: '割引', bids: '入札', timeLeft: '残り時間', minutes: '分', seconds: '秒', lastBidder: '最後の入札者', noOne: 'まだ誰も', bidNow: '今すぐ入札', view: '表示', refresh: '更新', lowActivityLabel: '入札少', endingSoonLabel: '間もなく終了', bargainScore: 'ディールスコア', settings: '設定', avgPrice: '平均価格', minPrice: '最低', maxPrice: '最高', soldTimes: '販売済み', noBargains: 'ディールが見つかりません', noBargainsDesc: '現在低活動のオークションはありません', checkBack: '後で再度確認！', loading: 'ディールを検索中...', howItWorks: 'ディールレーダーの仕組み', step1: '競争の少ないディールをすべてのアクティブオークションからスキャン', step2: '入札が少なく残り時間が短いオークションがハイライト', step3: '素早く行動 - これらのディールは数秒で消えます！'
  },
  ko: {
    title: '딜 레이더', subtitle: '경쟁이 적은 최고의 거래 찾기', bargains: '베스트 딜', lowActivity: '낮은 활동', endingSoon: '곧 종료', priceHistory: '가격 이력', currentPrice: '현재', retailPrice: '소매가', discount: '할인', bids: '입찰', timeLeft: '남은 시간', minutes: '분', seconds: '초', lastBidder: '마지막 입찰자', noOne: '아직 없음', bidNow: '지금 입찰', view: '보기', refresh: '새로고침', lowActivityLabel: '입찰 적음', endingSoonLabel: '곧 종료', bargainScore: '딜 점수', settings: '설정', avgPrice: '평균 가격', minPrice: '최저', maxPrice: '최고', soldTimes: '판매됨', noBargains: '딜을 찾을 수 없습니다', noBargainsDesc: '현재 낮은 활동의 경매가 없습니다', checkBack: '나중에 다시 확인!', loading: '딜 검색 중...', howItWorks: '딜 레이더 작동 방식', step1: '경쟁이 적은 딜을 모든 활성 경매에서 스캔', step2: '입찰이 적고 남은 시간이 짧은 경매가 강조됨', step3: '빠르게 행동 - 이 딜은 몇 초 만에 사라집니다!'
  },
  hi: {
    title: 'डील रडार', subtitle: 'कम प्रतिस्पर्धा वाले सर्वश्रेष्ठ सौदे खोजें', bargains: 'सर्वश्रेष्ठ सौदे', lowActivity: 'कम गतिविधि', endingSoon: 'जल्द समाप्त', priceHistory: 'मूल्य इतिहास', currentPrice: 'वर्तमान', retailPrice: 'खुदरा मूल्य', discount: 'छूट', bids: 'बोलियां', timeLeft: 'शेष समय', minutes: 'मिनट', seconds: 'सेकंड', lastBidder: 'अंतिम बोलीदाता', noOne: 'अभी कोई नहीं', bidNow: 'अभी बोली लगाएं', view: 'देखें', refresh: 'रिफ्रेश', lowActivityLabel: 'कम बोलियां', endingSoonLabel: 'जल्द समाप्त', bargainScore: 'डील स्कोर', settings: 'सेटिंग्स', avgPrice: 'औसत मूल्य', minPrice: 'न्यूनतम', maxPrice: 'अधिकतम', soldTimes: 'बिका', noBargains: 'कोई सौदा नहीं मिला', noBargainsDesc: 'वर्तमान में कम गतिविधि वाली कोई नीलामी नहीं', checkBack: 'बाद में वापस आएं!', loading: 'सौदे खोज रहे हैं...', howItWorks: 'डील रडार कैसे काम करता है?', step1: 'हम कम प्रतिस्पर्धा वाले सौदों के लिए सभी सक्रिय नीलामियों को स्कैन करते हैं', step2: 'कम बोलियों और कम शेष समय वाली नीलामियों को हाइलाइट किया जाता है', step3: 'तेजी से काम करें - ये सौदे सेकंडों में गायब हो जाते हैं!'
  },
  cs: {
    title: 'Radar nabídek', subtitle: 'Najděte nejlepší nabídky s nízkou konkurencí', bargains: 'Nejlepší nabídky', lowActivity: 'Nízká aktivita', endingSoon: 'Brzy končí', priceHistory: 'Historie cen', currentPrice: 'Aktuální', retailPrice: 'MPC', discount: 'Sleva', bids: 'Nabídky', timeLeft: 'Zbývající čas', minutes: 'min', seconds: 'sek', lastBidder: 'Poslední nabízející', noOne: 'Zatím nikdo', bidNow: 'Nabídnout nyní', view: 'Zobrazit', refresh: 'Obnovit', lowActivityLabel: 'Málo nabídek', endingSoonLabel: 'Brzy končí', bargainScore: 'Skóre nabídky', settings: 'Nastavení', avgPrice: 'Prům. cena', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'prodáno', noBargains: 'Žádné nabídky nenalezeny', noBargainsDesc: 'Aktuálně žádné aukce s nízkou aktivitou', checkBack: 'Vraťte se později!', loading: 'Hledání nabídek...', howItWorks: 'Jak funguje Radar nabídek?', step1: 'Skenujeme všechny aktivní aukce pro nabídky s nízkou konkurencí', step2: 'Aukce s málo nabídkami a krátkým zbývajícím časem jsou zvýrazněny', step3: 'Jednejte rychle - tyto nabídky mizí během sekund!'
  },
  sv: {
    title: 'Deal Radar', subtitle: 'Hitta de bästa erbjudandena med låg konkurrens', bargains: 'Bästa Fynd', lowActivity: 'Låg Aktivitet', endingSoon: 'Slutar Snart', priceHistory: 'Prishistorik', currentPrice: 'Nuvarande', retailPrice: 'Rek. pris', discount: 'Rabatt', bids: 'Bud', timeLeft: 'Tid Kvar', minutes: 'min', seconds: 'sek', lastBidder: 'Senaste Budgivare', noOne: 'Ingen ännu', bidNow: 'Buda Nu', view: 'Visa', refresh: 'Uppdatera', lowActivityLabel: 'Få Bud', endingSoonLabel: 'Slutar Snart', bargainScore: 'Deal Poäng', settings: 'Inställningar', avgPrice: 'Snitt Pris', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'såld', noBargains: 'Inga fynd hittade', noBargainsDesc: 'För närvarande inga auktioner med låg aktivitet', checkBack: 'Kom tillbaka senare!', loading: 'Söker erbjudanden...', howItWorks: 'Hur fungerar Deal Radar?', step1: 'Vi skannar alla aktiva auktioner efter erbjudanden med låg konkurrens', step2: 'Auktioner med få bud och kort återstående tid markeras', step3: 'Agera snabbt - dessa erbjudanden försvinner på sekunder!'
  },
  da: {
    title: 'Deal Radar', subtitle: 'Find de bedste tilbud med lav konkurrence', bargains: 'Bedste Fund', lowActivity: 'Lav Aktivitet', endingSoon: 'Slutter Snart', priceHistory: 'Prishistorik', currentPrice: 'Nuværende', retailPrice: 'Vej. pris', discount: 'Rabat', bids: 'Bud', timeLeft: 'Tid Tilbage', minutes: 'min', seconds: 'sek', lastBidder: 'Seneste Byder', noOne: 'Ingen endnu', bidNow: 'Byd Nu', view: 'Vis', refresh: 'Opdater', lowActivityLabel: 'Få Bud', endingSoonLabel: 'Slutter Snart', bargainScore: 'Deal Score', settings: 'Indstillinger', avgPrice: 'Gns. Pris', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'solgt', noBargains: 'Ingen fund fundet', noBargainsDesc: 'I øjeblikket ingen auktioner med lav aktivitet', checkBack: 'Kom tilbage senere!', loading: 'Søger tilbud...', howItWorks: 'Hvordan fungerer Deal Radar?', step1: 'Vi scanner alle aktive auktioner for tilbud med lav konkurrence', step2: 'Auktioner med få bud og kort resterende tid fremhæves', step3: 'Handl hurtigt - disse tilbud forsvinder på sekunder!'
  },
  fi: {
    title: 'Tarjousradar', subtitle: 'Löydä parhaat tarjoukset vähäisellä kilpailulla', bargains: 'Parhaat Löydöt', lowActivity: 'Matala Aktiivisuus', endingSoon: 'Päättyy Pian', priceHistory: 'Hintahistoria', currentPrice: 'Nykyinen', retailPrice: 'Ov. hinta', discount: 'Alennus', bids: 'Tarjoukset', timeLeft: 'Aikaa Jäljellä', minutes: 'min', seconds: 'sek', lastBidder: 'Viimeinen Tarjoaja', noOne: 'Ei vielä ketään', bidNow: 'Tarjoa Nyt', view: 'Näytä', refresh: 'Päivitä', lowActivityLabel: 'Vähän Tarjouksia', endingSoonLabel: 'Päättyy Pian', bargainScore: 'Tarjouspisteet', settings: 'Asetukset', avgPrice: 'Keskim. Hinta', minPrice: 'Min', maxPrice: 'Max', soldTimes: 'myyty', noBargains: 'Tarjouksia ei löytynyt', noBargainsDesc: 'Tällä hetkellä ei huutokauppoja matalalla aktiivisuudella', checkBack: 'Palaa myöhemmin!', loading: 'Etsitään tarjouksia...', howItWorks: 'Miten Tarjousradar toimii?', step1: 'Skannaamme kaikki aktiiviset huutokaupat tarjouksille vähäisellä kilpailulla', step2: 'Huutokaupat vähäisillä tarjouksilla ja lyhyellä jäljellä olevalla ajalla korostetaan', step3: 'Toimi nopeasti - nämä tarjoukset katoavat sekunneissa!'
  },
  el: {
    title: 'Ραντάρ Προσφορών', subtitle: 'Βρείτε τις καλύτερες προσφορές με χαμηλό ανταγωνισμό', bargains: 'Καλύτερες Ευκαιρίες', lowActivity: 'Χαμηλή Δραστηριότητα', endingSoon: 'Λήγει Σύντομα', priceHistory: 'Ιστορικό Τιμών', currentPrice: 'Τρέχουσα', retailPrice: 'Λιαν. Τιμή', discount: 'Έκπτωση', bids: 'Προσφορές', timeLeft: 'Χρόνος που Απομένει', minutes: 'λεπτά', seconds: 'δευτ', lastBidder: 'Τελευταίος Πλειοδότης', noOne: 'Κανείς ακόμα', bidNow: 'Πλειοδοτήστε', view: 'Δείτε', refresh: 'Ανανέωση', lowActivityLabel: 'Λίγες Προσφορές', endingSoonLabel: 'Λήγει Σύντομα', bargainScore: 'Βαθμός Ευκαιρίας', settings: 'Ρυθμίσεις', avgPrice: 'Μέση Τιμή', minPrice: 'Ελάχ', maxPrice: 'Μέγ', soldTimes: 'πωλήθηκε', noBargains: 'Δεν βρέθηκαν ευκαιρίες', noBargainsDesc: 'Αυτή τη στιγμή δεν υπάρχουν δημοπρασίες με χαμηλή δραστηριότητα', checkBack: 'Ελάτε αργότερα!', loading: 'Αναζήτηση προσφορών...', howItWorks: 'Πώς λειτουργεί το Ραντάρ Προσφορών;', step1: 'Σαρώνουμε όλες τις ενεργές δημοπρασίες για προσφορές με χαμηλό ανταγωνισμό', step2: 'Οι δημοπρασίες με λίγες προσφορές και σύντομο χρόνο επισημαίνονται', step3: 'Δράστε γρήγορα - αυτές οι προσφορές εξαφανίζονται σε δευτερόλεπτα!'
  }
};

// Timer display
const formatTime = (seconds) => {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Bargain Card Component
const BargainCard = ({ bargain, t, onBid }) => {
  const [timeLeft, setTimeLeft] = useState(bargain.seconds_left);
  const navigate = useNavigate();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const isUrgent = timeLeft < 60;
  const isEnding = timeLeft < 300;
  
  return (
    <div 
      className={`bg-white rounded-xl border-2 shadow-lg ${
        isUrgent ? 'border-red-500 animate-pulse' : 
        isEnding ? 'border-orange-500' : 
        'border-cyan-400'
      } overflow-hidden hover:shadow-xl transition-all cursor-pointer`}
      onClick={() => navigate(`/auctions/${bargain.auction_id}`)}
      data-testid={`bargain-${bargain.auction_id}`}
    >
      {/* Badges */}
      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-cyan-50 to-green-50">
        <div className="flex gap-1">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
            -{bargain.discount_percent}%
          </span>
          {bargain.is_low_activity && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
              {t.lowActivityLabel}
            </span>
          )}
          {bargain.is_ending_soon && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">
              {t.endingSoonLabel}
            </span>
          )}
        </div>
        <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${
          isUrgent ? 'bg-red-500 text-white' : 'bg-gray-700 text-white'
        }`}>
          {formatTime(timeLeft)}
        </span>
      </div>
      
      {/* Content */}
      <div className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
            {bargain.product_image ? (
              <img 
                src={bargain.product_image} 
                alt="" 
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <Target className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-800 font-bold text-sm line-clamp-2 mb-1">
              {bargain.product_name}
            </h3>
            <p className="text-gray-400 text-xs line-through">
              {t.retailPrice}: €{bargain.retail_price?.toLocaleString('de-DE')}
            </p>
            <p className="text-amber-600 font-bold text-lg">
              €{bargain.current_price?.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-gray-500 text-[10px]">
              {bargain.total_bids} {t.bids} • {bargain.last_bidder || t.noOne}
            </p>
          </div>
        </div>
        
        {/* Action */}
        <Button 
          onClick={(e) => { e.stopPropagation(); onBid(bargain.auction_id); }}
          className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
          size="sm"
        >
          <Zap className="w-4 h-4 mr-1" />
          {t.bidNow}
        </Button>
      </div>
    </div>
  );
};

// Price History Mini Component
const PriceHistoryMini = ({ productId, t }) => {
  const [history, setHistory] = useState(null);
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/api/deal-radar/price-history/${productId}`);
        setHistory(res.data);
      } catch (e) {
        console.error('Price history error:', e);
      }
    };
    if (productId) fetchHistory();
  }, [productId]);
  
  if (!history || history.total_sold === 0) return null;
  
  return (
    <div className="bg-gray-50 rounded-lg p-2 mt-2 border border-gray-100">
      <p className="text-[10px] text-gray-500 mb-1">{t.priceHistory} ({history.total_sold}x {t.soldTimes})</p>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{t.avgPrice}: <span className="text-gray-800 font-bold">€{history.avg_price}</span></span>
        <span className="text-green-600">{t.minPrice}: €{history.min_price}</span>
        <span className="text-red-600">{t.maxPrice}: €{history.max_price}</span>
      </div>
    </div>
  );
};

export default function DealRadarPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  
  // Get mapped language for translation (handle language codes like 'xk' -> 'sq')
  const langCode = mappedLanguage || language || 'de';
  const t = translations[langCode] || translations[language] || translations.de;
  
  const [bargains, setBargains] = useState([]);
  const [lowActivity, setLowActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('bargains');
  
  const fetchData = useCallback(async () => {
    try {
      const [bargainsRes, lowActivityRes] = await Promise.all([
        axios.get(`${API}/api/deal-radar/bargains?limit=12`),
        axios.get(`${API}/api/deal-radar/low-activity?limit=8`)
      ]);
      setBargains(bargainsRes.data.bargains || []);
      setLowActivity(lowActivityRes.data.auctions || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };
  
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an, um zu bieten');
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(
        `${API}/api/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot erfolgreich platziert!');
      fetchData(); // Refresh data
    } catch (error) {
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Bitte anmelden um zu bieten');
        navigate('/login');
        return;
      }
      const errorMessage = error.response?.data?.detail || 'Fehler beim Bieten';
      if (errorMessage.includes('Nicht genug Gebote') || errorMessage.includes('Not enough bids')) {
        toast.error('Du hast nicht genug Gebote. Kaufe mehr Gebote um weiterzubieten.');
      } else {
        toast.error(errorMessage);
      }
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Radar className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="deal-radar-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-100 border border-cyan-200 mb-4">
            <Radar className="w-5 h-5 text-cyan-600" />
            <span className="text-cyan-600 font-bold">RADAR</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-600 text-lg">{t.subtitle}</p>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Button
            variant={activeTab === 'bargains' ? 'default' : 'outline'}
            onClick={() => setActiveTab('bargains')}
            className={activeTab === 'bargains' ? 'bg-cyan-500 text-white' : 'border-gray-300 text-gray-700'}
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            {t.bargains} ({bargains.length})
          </Button>
          <Button
            variant={activeTab === 'lowActivity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('lowActivity')}
            className={activeTab === 'lowActivity' ? 'bg-blue-500 text-white' : 'border-gray-300 text-gray-700'}
          >
            <Activity className="w-4 h-4 mr-1" />
            {t.lowActivity} ({lowActivity.length})
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-gray-300 text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Content */}
        {activeTab === 'bargains' && (
          <>
            {bargains.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-gray-200">
                <Radar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl text-gray-800 mb-2">{t.noBargains}</h3>
                <p className="text-gray-600 mb-4">{t.noBargainsDesc}</p>
                <p className="text-gray-500 text-sm">{t.checkBack}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {bargains.map(bargain => (
                  <BargainCard 
                    key={bargain.auction_id} 
                    bargain={bargain} 
                    t={t} 
                    onBid={handleBid}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'lowActivity' && (
          <>
            {lowActivity.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-gray-200">
                <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl text-gray-800 mb-2">{t.noBargains}</h3>
                <p className="text-gray-600">{t.noBargainsDesc}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {lowActivity.map(auction => (
                  <BargainCard 
                    key={auction.auction_id} 
                    bargain={{
                      ...auction,
                      discount_percent: auction.retail_price > 0 
                        ? Math.round((1 - auction.current_price / auction.retail_price) * 100)
                        : 99,
                      is_low_activity: true,
                      is_ending_soon: auction.seconds_left < 300,
                      product_image: auction.product_image,
                      last_bidder: auction.last_bidder
                    }} 
                    t={t} 
                    onBid={handleBid}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Info Box */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-cyan-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t.howItWorks}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 font-bold flex-shrink-0">1</span>
              <p>{t.step1}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 font-bold flex-shrink-0">2</span>
              <p>{t.step2}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 font-bold flex-shrink-0">3</span>
              <p>{t.step3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
