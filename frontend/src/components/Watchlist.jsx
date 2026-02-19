/**
 * Watchlist - Auktionen beobachten und Benachrichtigungen
 * Features: Watchlist hinzufügen/entfernen, Benachrichtigungen, Timer
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Bell, Clock, Trash2, RefreshCw, Eye, AlertTriangle,
  ChevronRight, Settings, X, Check, Timer
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const Watchlist = ({ token, language = 'de' }) => {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, ended, all

  const t = (key) => {
    const translations = {
      de: {
        title: 'Meine Watchlist',
        subtitle: 'Beobachtete Auktionen',
        empty: 'Keine Auktionen auf der Watchlist',
        emptyHint: 'Klicke auf das Herz-Symbol bei einer Auktion, um sie hinzuzufügen',
        endingSoon: 'Endet bald',
        active: 'Aktiv',
        ended: 'Beendet',
        all: 'Alle',
        remove: 'Entfernen',
        viewAuction: 'Zur Auktion',
        notifyBefore: 'Benachrichtigen vor',
        minutes: 'Minuten',
        clearAll: 'Alle löschen',
        confirmClear: 'Wirklich alle löschen?',
        priceAtAdd: 'Preis beim Hinzufügen',
        currentPrice: 'Aktueller Preis',
        bids: 'Gebote',
        timeLeft: 'Verbleibend',
        settings: 'Einstellungen',
        toAuctions: 'Zu den Auktionen',
        added: 'Hinzugefügt'
      },
      en: {
        title: 'My Watchlist',
        subtitle: 'Watched auctions',
        empty: 'No auctions on watchlist',
        emptyHint: 'Click the heart icon on an auction to add it',
        endingSoon: 'Ending soon',
        active: 'Active',
        ended: 'Ended',
        all: 'All',
        remove: 'Remove',
        viewAuction: 'View Auction',
        notifyBefore: 'Notify before',
        minutes: 'minutes',
        clearAll: 'Clear all',
        confirmClear: 'Really clear all?',
        priceAtAdd: 'Price when added',
        currentPrice: 'Current price',
        bids: 'Bids',
        timeLeft: 'Time left',
        settings: 'Settings',
        toAuctions: 'Go to auctions',
        added: 'Added'
      },
      tr: {
        title: 'İzleme Listem',
        subtitle: 'İzlenen açık artırmalar',
        empty: 'İzleme listesinde açık artırma yok',
        emptyHint: 'Eklemek için bir açık artırmadaki kalp simgesine tıklayın',
        endingSoon: 'Yakında bitiyor',
        active: 'Aktif',
        ended: 'Sona erdi',
        all: 'Tümü',
        remove: 'Kaldır',
        viewAuction: 'Açık Artırmaya Git',
        notifyBefore: 'Önce bildir',
        minutes: 'dakika',
        clearAll: 'Tümünü sil',
        confirmClear: 'Tümünü silmek istediğinizden emin misiniz?',
        priceAtAdd: 'Eklendiğindeki fiyat',
        currentPrice: 'Mevcut fiyat',
        bids: 'Teklifler',
        timeLeft: 'Kalan süre',
        settings: 'Ayarlar',
        toAuctions: 'Açık artırmalara git',
        added: 'Eklendi'
      },
      fr: {
        title: 'Ma Liste de Suivi',
        subtitle: 'Enchères surveillées',
        empty: 'Aucune enchère dans la liste',
        emptyHint: 'Cliquez sur le cœur d\'une enchère pour l\'ajouter',
        endingSoon: 'Se termine bientôt',
        active: 'Actif',
        ended: 'Terminé',
        all: 'Tout',
        remove: 'Supprimer',
        viewAuction: 'Voir l\'enchère',
        notifyBefore: 'Notifier avant',
        minutes: 'minutes',
        clearAll: 'Tout effacer',
        confirmClear: 'Vraiment tout effacer?',
        priceAtAdd: 'Prix à l\'ajout',
        currentPrice: 'Prix actuel',
        bids: 'Offres',
        timeLeft: 'Temps restant',
        settings: 'Paramètres',
        toAuctions: 'Aller aux enchères',
        added: 'Ajouté'
      },
      es: {
        title: 'Mi Lista de Seguimiento',
        subtitle: 'Subastas vigiladas',
        empty: 'No hay subastas en la lista',
        emptyHint: 'Haz clic en el corazón de una subasta para añadirla',
        endingSoon: 'Termina pronto',
        active: 'Activo',
        ended: 'Terminado',
        all: 'Todo',
        remove: 'Eliminar',
        viewAuction: 'Ver subasta',
        notifyBefore: 'Notificar antes',
        minutes: 'minutos',
        clearAll: 'Borrar todo',
        confirmClear: '¿Realmente borrar todo?',
        priceAtAdd: 'Precio al añadir',
        currentPrice: 'Precio actual',
        bids: 'Pujas',
        timeLeft: 'Tiempo restante',
        settings: 'Configuración',
        toAuctions: 'Ir a subastas',
        added: 'Añadido'
      },
      ar: {
        title: 'قائمة المراقبة',
        subtitle: 'المزادات المراقبة',
        empty: 'لا توجد مزادات في القائمة',
        emptyHint: 'انقر على أيقونة القلب في المزاد لإضافته',
        endingSoon: 'ينتهي قريباً',
        active: 'نشط',
        ended: 'انتهى',
        all: 'الكل',
        remove: 'إزالة',
        viewAuction: 'عرض المزاد',
        notifyBefore: 'إشعار قبل',
        minutes: 'دقائق',
        clearAll: 'مسح الكل',
        confirmClear: 'هل تريد مسح الكل؟',
        priceAtAdd: 'السعر عند الإضافة',
        currentPrice: 'السعر الحالي',
        bids: 'المزايدات',
        timeLeft: 'الوقت المتبقي',
        settings: 'الإعدادات',
        toAuctions: 'الذهاب للمزادات',
        added: 'أضيف'
      },
      it: {
        title: 'La Mia Lista',
        subtitle: 'Aste monitorate',
        empty: 'Nessuna asta nella lista',
        emptyHint: 'Clicca sul cuore di un\'asta per aggiungerla',
        endingSoon: 'In scadenza',
        active: 'Attivo',
        ended: 'Terminato',
        all: 'Tutto',
        remove: 'Rimuovi',
        viewAuction: 'Vedi asta',
        notifyBefore: 'Notifica prima',
        minutes: 'minuti',
        clearAll: 'Cancella tutto',
        confirmClear: 'Cancellare tutto?',
        priceAtAdd: 'Prezzo all\'aggiunta',
        currentPrice: 'Prezzo attuale',
        bids: 'Offerte',
        timeLeft: 'Tempo rimasto',
        settings: 'Impostazioni',
        toAuctions: 'Vai alle aste',
        added: 'Aggiunto'
      },
      pt: {
        title: 'Minha Lista',
        subtitle: 'Leilões monitorados',
        empty: 'Nenhum leilão na lista',
        emptyHint: 'Clique no coração de um leilão para adicioná-lo',
        endingSoon: 'Terminando em breve',
        active: 'Ativo',
        ended: 'Terminado',
        all: 'Todos',
        remove: 'Remover',
        viewAuction: 'Ver leilão',
        notifyBefore: 'Notificar antes',
        minutes: 'minutos',
        clearAll: 'Limpar tudo',
        confirmClear: 'Realmente limpar tudo?',
        priceAtAdd: 'Preço ao adicionar',
        currentPrice: 'Preço atual',
        bids: 'Lances',
        timeLeft: 'Tempo restante',
        settings: 'Configurações',
        toAuctions: 'Ir para leilões',
        added: 'Adicionado'
      },
      nl: {
        title: 'Mijn Volglijst',
        subtitle: 'Gevolgde veilingen',
        empty: 'Geen veilingen op de lijst',
        emptyHint: 'Klik op het hartje bij een veiling om toe te voegen',
        endingSoon: 'Eindigt binnenkort',
        active: 'Actief',
        ended: 'Beëindigd',
        all: 'Alles',
        remove: 'Verwijderen',
        viewAuction: 'Bekijk veiling',
        notifyBefore: 'Melden voor',
        minutes: 'minuten',
        clearAll: 'Alles wissen',
        confirmClear: 'Echt alles wissen?',
        priceAtAdd: 'Prijs bij toevoegen',
        currentPrice: 'Huidige prijs',
        bids: 'Biedingen',
        timeLeft: 'Resterende tijd',
        settings: 'Instellingen',
        toAuctions: 'Naar veilingen',
        added: 'Toegevoegd'
      },
      pl: {
        title: 'Moja Lista',
        subtitle: 'Obserwowane aukcje',
        empty: 'Brak aukcji na liście',
        emptyHint: 'Kliknij serce przy aukcji, aby ją dodać',
        endingSoon: 'Kończy się wkrótce',
        active: 'Aktywny',
        ended: 'Zakończony',
        all: 'Wszystko',
        remove: 'Usuń',
        viewAuction: 'Zobacz aukcję',
        notifyBefore: 'Powiadom przed',
        minutes: 'minut',
        clearAll: 'Wyczyść wszystko',
        confirmClear: 'Na pewno wyczyścić?',
        priceAtAdd: 'Cena przy dodaniu',
        currentPrice: 'Aktualna cena',
        bids: 'Oferty',
        timeLeft: 'Pozostały czas',
        settings: 'Ustawienia',
        toAuctions: 'Idź do aukcji',
        added: 'Dodano'
      },
      ru: {
        title: 'Мой Список',
        subtitle: 'Отслеживаемые аукционы',
        empty: 'Нет аукционов в списке',
        emptyHint: 'Нажмите на сердце у аукциона, чтобы добавить',
        endingSoon: 'Скоро заканчивается',
        active: 'Активный',
        ended: 'Завершён',
        all: 'Все',
        remove: 'Удалить',
        viewAuction: 'Смотреть аукцион',
        notifyBefore: 'Уведомить за',
        minutes: 'минут',
        clearAll: 'Очистить всё',
        confirmClear: 'Действительно очистить?',
        priceAtAdd: 'Цена при добавлении',
        currentPrice: 'Текущая цена',
        bids: 'Ставки',
        timeLeft: 'Осталось времени',
        settings: 'Настройки',
        toAuctions: 'К аукционам',
        added: 'Добавлено'
      },
      zh: {
        title: '我的关注列表',
        subtitle: '关注的拍卖',
        empty: '列表中没有拍卖',
        emptyHint: '点击拍卖上的心形图标添加',
        endingSoon: '即将结束',
        active: '进行中',
        ended: '已结束',
        all: '全部',
        remove: '移除',
        viewAuction: '查看拍卖',
        notifyBefore: '提前通知',
        minutes: '分钟',
        clearAll: '清空全部',
        confirmClear: '确定清空全部?',
        priceAtAdd: '添加时价格',
        currentPrice: '当前价格',
        bids: '出价',
        timeLeft: '剩余时间',
        settings: '设置',
        toAuctions: '去拍卖',
        added: '已添加'
      },
      ja: {
        title: 'マイウォッチリスト',
        subtitle: '監視中のオークション',
        empty: 'リストにオークションがありません',
        emptyHint: 'オークションのハートアイコンをクリックして追加',
        endingSoon: 'まもなく終了',
        active: 'アクティブ',
        ended: '終了',
        all: 'すべて',
        remove: '削除',
        viewAuction: 'オークションを見る',
        notifyBefore: '前に通知',
        minutes: '分',
        clearAll: 'すべてクリア',
        confirmClear: '本当にクリアしますか?',
        priceAtAdd: '追加時の価格',
        currentPrice: '現在の価格',
        bids: '入札',
        timeLeft: '残り時間',
        settings: '設定',
        toAuctions: 'オークションへ',
        added: '追加済み'
      },
      ko: {
        title: '내 관심 목록',
        subtitle: '관심 경매',
        empty: '목록에 경매가 없습니다',
        emptyHint: '경매의 하트 아이콘을 클릭하여 추가하세요',
        endingSoon: '곧 종료',
        active: '활성',
        ended: '종료됨',
        all: '전체',
        remove: '제거',
        viewAuction: '경매 보기',
        notifyBefore: '전에 알림',
        minutes: '분',
        clearAll: '모두 지우기',
        confirmClear: '정말 모두 지우시겠습니까?',
        priceAtAdd: '추가 시 가격',
        currentPrice: '현재 가격',
        bids: '입찰',
        timeLeft: '남은 시간',
        settings: '설정',
        toAuctions: '경매로 이동',
        added: '추가됨'
      },
      sq: {
        title: 'Lista Ime',
        subtitle: 'Ankandet e ndjekura',
        empty: 'Asnjë ankand në listë',
        emptyHint: 'Kliko zemrën te një ankand për ta shtuar',
        endingSoon: 'Mbaron së shpejti',
        active: 'Aktiv',
        ended: 'Përfunduar',
        all: 'Të gjitha',
        remove: 'Hiq',
        viewAuction: 'Shiko ankandin',
        notifyBefore: 'Njofto para',
        minutes: 'minuta',
        clearAll: 'Pastro të gjitha',
        confirmClear: 'Vërtet pastro?',
        priceAtAdd: 'Çmimi kur u shtua',
        currentPrice: 'Çmimi aktual',
        bids: 'Ofertat',
        timeLeft: 'Koha e mbetur',
        settings: 'Cilësimet',
        toAuctions: 'Shko te ankandet',
        added: 'Shtuar'
      },
      el: {
        title: 'Η Λίστα Μου',
        subtitle: 'Παρακολουθούμενες δημοπρασίες',
        empty: 'Δεν υπάρχουν δημοπρασίες στη λίστα',
        emptyHint: 'Κάντε κλικ στην καρδιά μιας δημοπρασίας για να την προσθέσετε',
        endingSoon: 'Λήγει σύντομα',
        active: 'Ενεργή',
        ended: 'Τελείωσε',
        all: 'Όλα',
        remove: 'Αφαίρεση',
        viewAuction: 'Προβολή δημοπρασίας',
        notifyBefore: 'Ειδοποίηση πριν',
        minutes: 'λεπτά',
        clearAll: 'Εκκαθάριση όλων',
        confirmClear: 'Σίγουρα εκκαθάριση;',
        priceAtAdd: 'Τιμή κατά την προσθήκη',
        currentPrice: 'Τρέχουσα τιμή',
        bids: 'Προσφορές',
        timeLeft: 'Χρόνος που απομένει',
        settings: 'Ρυθμίσεις',
        toAuctions: 'Στις δημοπρασίες',
        added: 'Προστέθηκε'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchWatchlist = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/watchlist/my-watchlist?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const removeFromWatchlist = async (auctionId) => {
    try {
      const response = await fetch(`${API}/api/watchlist/remove/${auctionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setWatchlist(prev => prev.filter(w => w.auction_id !== auctionId));
        toast.success('Von Watchlist entfernt');
      }
    } catch (error) {
      toast.error('Fehler beim Entfernen');
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('confirmClear'))) return;
    
    try {
      const response = await fetch(`${API}/api/watchlist/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setWatchlist([]);
        toast.success('Watchlist geleert');
      }
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const endingSoonCount = watchlist.filter(w => w.auction?.ending_soon).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4" data-testid="watchlist-page">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500" />
              {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">{t('subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {endingSoonCount > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm">
                <AlertTriangle className="w-4 h-4" />
                {endingSoonCount} {t('endingSoon')}
              </div>
            )}
            <Button
              onClick={fetchWatchlist}
              variant="outline"
              size="sm"
              className="border-gray-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {['active', 'ended', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t(f)}
            </button>
          ))}
          
          {watchlist.length > 0 && (
            <button
              onClick={clearAll}
              className="ml-auto px-3 py-2 text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {t('clearAll')}
            </button>
          )}
        </div>

        {/* Watchlist Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">{t('empty')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('emptyHint')}</p>
            <Button
              onClick={() => navigate('/auctions')}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Zu den Auktionen
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {watchlist.map((item) => (
              <WatchlistItem
                key={item.id}
                item={item}
                onRemove={() => removeFromWatchlist(item.auction_id)}
                onView={() => navigate(`/auctions/${item.auction_id}`)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Watchlist Item Component
const WatchlistItem = ({ item, onRemove, onView, t }) => {
  const auction = item.auction || {};
  const isEndingSoon = auction.ending_soon;
  const isEnded = auction.status !== 'active';
  
  return (
    <div 
      className={`bg-gray-800/50 rounded-xl p-4 border transition-all ${
        isEndingSoon ? 'border-red-500/50 bg-red-500/10' : 'border-gray-700/50'
      }`}
      data-testid={`watchlist-item-${item.auction_id}`}
    >
      <div className="flex items-center gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
          {auction.image_url ? (
            <img 
              src={auction.image_url} 
              alt={auction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <Eye className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{auction.title || 'Unbekannt'}</h3>
          
          <div className="flex items-center gap-4 mt-2 text-sm">
            <div>
              <span className="text-gray-400">{t('currentPrice')}:</span>
              <span className="text-amber-400 font-bold ml-1">€{auction.current_price?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="text-gray-500">
              {auction.bid_count || 0} {t('bids')}
            </div>
          </div>
          
          {/* Time Remaining */}
          {!isEnded && auction.time_remaining && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              isEndingSoon ? 'text-red-400' : 'text-gray-400'
            }`}>
              <Timer className="w-4 h-4" />
              <span>{t('timeLeft')}: </span>
              <span className="font-mono font-medium">
                {Math.floor(auction.time_remaining / 3600)}h {Math.floor((auction.time_remaining % 3600) / 60)}m
              </span>
              {isEndingSoon && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                  {t('endingSoon')}!
                </span>
              )}
            </div>
          )}
          
          {isEnded && (
            <div className="mt-2 px-2 py-1 bg-gray-600/50 text-gray-400 rounded text-sm inline-block">
              {t('ended')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={onView}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={onRemove}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Added Info */}
      <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-between text-xs text-gray-500">
        <span>Hinzugefügt: {new Date(item.added_at).toLocaleDateString('de-DE')}</span>
        <span>{t('priceAtAdd')}: €{item.price_at_add?.toFixed(2) || '0.00'}</span>
      </div>
    </div>
  );
};

export default Watchlist;
