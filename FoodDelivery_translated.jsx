/**
 * Food Delivery Page - Order from restaurants
 * With full i18n translation support
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Coffee, MapPin, Star, Clock, Euro, Plus, Minus, ShoppingBag, ArrowLeft, Loader2, CheckCircle, Search } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Translations for FoodDelivery
const foodTranslations = {
  de: {
    title: 'Essen bestellen',
    subtitle: 'Lieferung direkt zu dir',
    searchPlaceholder: 'Restaurant suchen...',
    delivery: 'Lieferung',
    ordered: 'Bestellt!',
    done: 'Fertig',
    order: 'Bestellen',
    items: 'Artikel',
    mainDish1: 'Hauptgericht 1',
    mainDish1Desc: 'Spezialität des Hauses',
    mainDish2: 'Hauptgericht 2',
    mainDish2Desc: 'Vegetarische Option',
    appetizer: 'Vorspeise',
    appetizerDesc: 'Tagessuppe oder Salat',
    dessert: 'Dessert',
    dessertDesc: 'Hausdessert',
    drink: 'Getränk',
    drinkDesc: 'Softdrink oder Wasser',
    error: 'Fehler',
    myLocation: 'Mein Standort'
  },
  en: {
    title: 'Order Food',
    subtitle: 'Delivery right to you',
    searchPlaceholder: 'Search restaurant...',
    delivery: 'Delivery',
    ordered: 'Ordered!',
    done: 'Done',
    order: 'Order',
    items: 'items',
    mainDish1: 'Main Dish 1',
    mainDish1Desc: 'House specialty',
    mainDish2: 'Main Dish 2',
    mainDish2Desc: 'Vegetarian option',
    appetizer: 'Appetizer',
    appetizerDesc: 'Daily soup or salad',
    dessert: 'Dessert',
    dessertDesc: 'House dessert',
    drink: 'Drink',
    drinkDesc: 'Soft drink or water',
    error: 'Error',
    myLocation: 'My location'
  },
  sq: {
    title: 'Porosit Ushqim',
    subtitle: 'Dërgesë direkt tek ti',
    searchPlaceholder: 'Kërko restorant...',
    delivery: 'Dërgesë',
    ordered: 'U porosit!',
    done: 'Gati',
    order: 'Porosit',
    items: 'artikuj',
    mainDish1: 'Pjatë Kryesore 1',
    mainDish1Desc: 'Specialiteti i shtëpisë',
    mainDish2: 'Pjatë Kryesore 2',
    mainDish2Desc: 'Opsioni vegjetarian',
    appetizer: 'Antipastë',
    appetizerDesc: 'Supë ditore ose sallatë',
    dessert: 'Ëmbëlsirë',
    dessertDesc: 'Ëmbëlsira e shtëpisë',
    drink: 'Pije',
    drinkDesc: 'Pije e butë ose ujë',
    error: 'Gabim',
    myLocation: 'Vendndodhja ime'
  },
  ar: {
    title: 'طلب الطعام',
    subtitle: 'توصيل مباشر إليك',
    searchPlaceholder: 'ابحث عن مطعم...',
    delivery: 'توصيل',
    ordered: 'تم الطلب!',
    done: 'تم',
    order: 'اطلب',
    items: 'عناصر',
    mainDish1: 'الطبق الرئيسي 1',
    mainDish1Desc: 'تخصص المنزل',
    mainDish2: 'الطبق الرئيسي 2',
    mainDish2Desc: 'خيار نباتي',
    appetizer: 'مقبلات',
    appetizerDesc: 'شوربة اليوم أو سلطة',
    dessert: 'حلوى',
    dessertDesc: 'حلوى المنزل',
    drink: 'مشروب',
    drinkDesc: 'مشروب غازي أو ماء',
    error: 'خطأ',
    myLocation: 'موقعي'
  },
  tr: {
    title: 'Yemek Sipariş Et',
    subtitle: 'Doğrudan sana teslimat',
    searchPlaceholder: 'Restoran ara...',
    delivery: 'Teslimat',
    ordered: 'Sipariş verildi!',
    done: 'Tamam',
    order: 'Sipariş Ver',
    items: 'ürün',
    mainDish1: 'Ana Yemek 1',
    mainDish1Desc: 'Şefin özel yemeği',
    mainDish2: 'Ana Yemek 2',
    mainDish2Desc: 'Vejetaryen seçeneği',
    appetizer: 'Başlangıç',
    appetizerDesc: 'Günün çorbası veya salata',
    dessert: 'Tatlı',
    dessertDesc: 'Evin tatlısı',
    drink: 'İçecek',
    drinkDesc: 'Meşrubat veya su',
    error: 'Hata',
    myLocation: 'Konumum'
  },
  fr: {
    title: 'Commander à manger',
    subtitle: 'Livraison directe chez vous',
    searchPlaceholder: 'Rechercher un restaurant...',
    delivery: 'Livraison',
    ordered: 'Commandé!',
    done: 'Terminé',
    order: 'Commander',
    items: 'articles',
    mainDish1: 'Plat Principal 1',
    mainDish1Desc: 'Spécialité de la maison',
    mainDish2: 'Plat Principal 2',
    mainDish2Desc: 'Option végétarienne',
    appetizer: 'Entrée',
    appetizerDesc: 'Soupe du jour ou salade',
    dessert: 'Dessert',
    dessertDesc: 'Dessert maison',
    drink: 'Boisson',
    drinkDesc: 'Boisson gazeuse ou eau',
    error: 'Erreur',
    myLocation: 'Ma position'
  }
};

export default function FoodDelivery() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const langKey = language === 'ae' ? 'ar' : language === 'xk' ? 'sq' : language === 'gb' ? 'en' : language;
  const t = foodTranslations[langKey] || foodTranslations.de;
  
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);
  const [ordering, setOrdering] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { axios.get(`${API}/features/food/restaurants`).then(r => setRestaurants(r.data.restaurants || [])).catch(() => {}); }, []);

  const addToCart = (item) => { const ex = cart.find(c => c.name === item.name); if (ex) setCart(cart.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c)); else setCart([...cart, { ...item, qty: 1 }]); };
  const removeFromCart = (name) => { setCart(cart.map(c => c.name === name ? { ...c, qty: c.qty - 1 } : c).filter(c => c.qty > 0)); };
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const handleOrder = async () => {
    setOrdering(true);
    try {
      await axios.post(`${API}/features/food/order`, { restaurant_name: selected.name, items: cart, delivery_address: t.myLocation, delivery_lat: 42.663, delivery_lng: 21.165 }, { headers: { Authorization: `Bearer ${token}` } });
      setDone(true);
    } catch (e) { toast.error(e.response?.data?.detail || t.error); }
    finally { setOrdering(false); }
  };

  if (done) return (<div className="min-h-screen bg-emerald-500 flex items-center justify-center p-4"><div className="text-center text-white"><CheckCircle className="w-20 h-20 mx-auto mb-4" /><h1 className="text-2xl font-bold mb-2">{t.ordered}</h1><p className="text-emerald-100">{selected?.name} | {selected?.delivery_time}</p><a href="/" className="mt-6 inline-block px-8 py-3 bg-white text-emerald-600 font-bold rounded-xl">{t.done}</a></div></div>);

  if (selected) {
    const MENU = [
      { name: t.mainDish1, price: 18.90, desc: t.mainDish1Desc },
      { name: t.mainDish2, price: 14.50, desc: t.mainDish2Desc },
      { name: t.appetizer, price: 8.90, desc: t.appetizerDesc },
      { name: t.dessert, price: 7.50, desc: t.dessertDesc },
      { name: t.drink, price: 3.50, desc: t.drinkDesc },
    ];
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-32" data-testid="food-menu">
        <div className="relative h-40 bg-cover bg-center" style={{ backgroundImage: `url(${selected.image})` }}><div className="absolute inset-0 bg-black/40" /><button onClick={() => { setSelected(null); setCart([]); }} className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-white" /></button><div className="absolute bottom-4 left-4 text-white"><h1 className="text-xl font-bold">{selected.name}</h1><p className="text-sm text-white/80">{selected.category} | {selected.delivery_time}</p></div></div>
        <div className="p-4 space-y-2">
          {MENU.map(item => { const inCart = cart.find(c => c.name === item.name); return (
            <div key={item.name} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between">
              <div><p className="font-bold text-slate-800 text-sm">{item.name}</p><p className="text-xs text-slate-500">{item.desc}</p><p className="text-orange-600 font-bold mt-1">{item.price.toFixed(2)} EUR</p></div>
              <div className="flex items-center gap-2">{inCart ? (<><button onClick={() => removeFromCart(item.name)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center"><Minus className="w-4 h-4" /></button><span className="font-bold w-6 text-center">{inCart.qty}</span></>) : null}<button onClick={() => addToCart(item)} className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center"><Plus className="w-4 h-4" /></button></div>
            </div>);
          })}
        </div>
        {cart.length > 0 && (<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-xl"><div className="max-w-lg mx-auto flex items-center justify-between"><div><p className="text-slate-500 text-xs">{cart.reduce((s, c) => s + c.qty, 0)} {t.items}</p><p className="font-bold text-lg">{total.toFixed(2)} EUR</p></div><button onClick={handleOrder} disabled={ordering} className="px-8 py-3 bg-orange-500 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50">{ordering ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingBag className="w-5 h-5" /> {t.order}</>}</button></div></div>)}
      </div>);
  }

  const filtered = restaurants.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white p-4 pb-24" data-testid="food-delivery">
      <div className="max-w-lg mx-auto pt-2">
        <div className="text-center mb-6"><Coffee className="w-12 h-12 text-orange-500 mx-auto mb-2" /><h1 className="text-xl font-bold text-slate-800">{t.title}</h1><p className="text-slate-500 text-sm">{t.subtitle}</p></div>
        <div className="relative mb-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPlaceholder} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm" /></div>
        <div className="space-y-3">
          {filtered.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} className="w-full bg-white rounded-xl border border-slate-100 overflow-hidden flex text-left hover:shadow-md transition-shadow">
              <img src={r.image} alt="" className="w-24 h-24 object-cover" loading="lazy" />
              <div className="p-3 flex-1">
                <h3 className="font-bold text-sm text-slate-800">{r.name}</h3>
                <p className="text-xs text-slate-500">{r.category}</p>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="flex items-center gap-0.5 text-amber-500"><Star className="w-3 h-3 fill-amber-400" />{r.rating}</span>
                  <span className="text-slate-400"><Clock className="w-3 h-3 inline" /> {r.delivery_time}</span>
                  <span className="text-emerald-600">{r.delivery_fee} EUR {t.delivery}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>);
}
