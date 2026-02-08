import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Gift, Search, Send, History, Copy, Check, User, 
  ArrowRight, ArrowLeft, Sparkles, Heart, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Translations for GiftBids page
const translations = {
  de: {
    title: 'Gebote verschenken',
    subtitle: 'Schenken Sie Ihren Freunden und Familie Gebote!',
    yourCustomerNumber: 'Ihre Kundennummer',
    shareNumber: 'Teilen Sie diese Nummer mit Freunden, damit diese Ihnen Gebote schenken können',
    yourBalance: 'Ihr Guthaben',
    bids: 'Gebote',
    sendBids: 'Gebote senden',
    history: 'Verlauf',
    giftBids: 'Gebote verschenken',
    findRecipient: 'Empfänger suchen',
    enterCustomerNumber: '8-stellige Kundennummer eingeben',
    numberOfBids: 'Anzahl der Gebote',
    orEnterCustom: 'Oder eigene Anzahl eingeben',
    available: 'Verfügbar',
    messageOptional: 'Nachricht (optional)',
    messagePlaceholder: 'z.B. Alles Gute zum Geburtstag! 🎉',
    sendGift: 'Geschenk senden',
    sending: 'Wird gesendet...',
    sent: 'Gesendet',
    received: 'Erhalten',
    giftsGiven: 'Gebote verschenkt',
    giftsReceived: 'Gebote erhalten',
    sentGifts: 'Gesendete Geschenke',
    receivedGifts: 'Erhaltene Geschenke',
    to: 'An',
    from: 'Von',
    noSentGifts: 'Noch keine Geschenke gesendet',
    noReceivedGifts: 'Noch keine Geschenke erhalten',
    recipientFound: 'Empfänger gefunden',
    customerNumberLabel: 'Kundennummer',
    login: 'Anmelden',
    loginToGift: 'Melden Sie sich an, um Gebote zu verschenken',
    copied: 'Kopiert!',
    notFound: 'Kundennummer nicht gefunden',
    notEnoughBids: 'Nicht genügend Gebote vorhanden',
    minOneBid: 'Mindestens 1 Gebot erforderlich',
    searchFirst: 'Bitte suchen Sie zuerst einen Empfänger',
    enterValidNumber: 'Bitte geben Sie eine gültige 8-stellige Kundennummer ein',
    enterValidAmount: 'Bitte geben Sie eine gültige Anzahl ein'
  },
  en: {
    title: 'Gift Bids',
    subtitle: 'Gift bids to your friends and family!',
    yourCustomerNumber: 'Your Customer Number',
    shareNumber: 'Share this number with friends so they can gift you bids',
    yourBalance: 'Your Balance',
    bids: 'Bids',
    sendBids: 'Send Bids',
    history: 'History',
    giftBids: 'Gift Bids',
    findRecipient: 'Find Recipient',
    enterCustomerNumber: 'Enter 8-digit customer number',
    numberOfBids: 'Number of Bids',
    orEnterCustom: 'Or enter custom amount',
    available: 'Available',
    messageOptional: 'Message (optional)',
    messagePlaceholder: 'e.g. Happy Birthday! 🎉',
    sendGift: 'Send Gift',
    sending: 'Sending...',
    sent: 'Sent',
    received: 'Received',
    giftsGiven: 'Bids gifted',
    giftsReceived: 'Bids received',
    sentGifts: 'Sent Gifts',
    receivedGifts: 'Received Gifts',
    to: 'To',
    from: 'From',
    noSentGifts: 'No gifts sent yet',
    noReceivedGifts: 'No gifts received yet',
    recipientFound: 'Recipient found',
    customerNumberLabel: 'Customer Number',
    login: 'Login',
    loginToGift: 'Please login to gift bids',
    copied: 'Copied!',
    notFound: 'Customer number not found',
    notEnoughBids: 'Not enough bids available',
    minOneBid: 'Minimum 1 bid required',
    searchFirst: 'Please search for a recipient first',
    enterValidNumber: 'Please enter a valid 8-digit customer number',
    enterValidAmount: 'Please enter a valid amount'
  },
  tr: {
    title: 'Teklif Hediye Et',
    subtitle: 'Arkadaşlarınıza ve ailenize teklif hediye edin!',
    yourCustomerNumber: 'Müşteri Numaranız',
    shareNumber: 'Bu numarayı arkadaşlarınızla paylaşın, böylece size teklif hediye edebilirler',
    yourBalance: 'Bakiyeniz',
    bids: 'Teklif',
    sendBids: 'Teklif Gönder',
    history: 'Geçmiş',
    giftBids: 'Teklif Hediye Et',
    findRecipient: 'Alıcı Bul',
    enterCustomerNumber: '8 haneli müşteri numarası girin',
    numberOfBids: 'Teklif Sayısı',
    orEnterCustom: 'Veya özel miktar girin',
    available: 'Mevcut',
    messageOptional: 'Mesaj (isteğe bağlı)',
    messagePlaceholder: 'örn. Doğum günün kutlu olsun! 🎉',
    sendGift: 'Hediye Gönder',
    sending: 'Gönderiliyor...',
    sent: 'Gönderildi',
    received: 'Alındı',
    giftsGiven: 'Hediye edilen teklifler',
    giftsReceived: 'Alınan teklifler',
    sentGifts: 'Gönderilen Hediyeler',
    receivedGifts: 'Alınan Hediyeler',
    to: 'Kime',
    from: 'Kimden',
    noSentGifts: 'Henüz hediye gönderilmedi',
    noReceivedGifts: 'Henüz hediye alınmadı',
    recipientFound: 'Alıcı bulundu',
    customerNumberLabel: 'Müşteri Numarası',
    login: 'Giriş Yap',
    loginToGift: 'Teklif hediye etmek için giriş yapın',
    copied: 'Kopyalandı!',
    notFound: 'Müşteri numarası bulunamadı',
    notEnoughBids: 'Yeterli teklif yok',
    minOneBid: 'Minimum 1 teklif gerekli',
    searchFirst: 'Lütfen önce bir alıcı arayın',
    enterValidNumber: 'Lütfen geçerli 8 haneli müşteri numarası girin',
    enterValidAmount: 'Lütfen geçerli bir miktar girin'
  },
  fr: {
    title: 'Offrir des Enchères',
    subtitle: 'Offrez des enchères à vos amis et votre famille!',
    yourCustomerNumber: 'Votre Numéro Client',
    shareNumber: 'Partagez ce numéro avec vos amis pour qu\'ils puissent vous offrir des enchères',
    yourBalance: 'Votre Solde',
    bids: 'Enchères',
    sendBids: 'Envoyer',
    history: 'Historique',
    giftBids: 'Offrir des Enchères',
    findRecipient: 'Trouver Destinataire',
    enterCustomerNumber: 'Entrez le numéro client à 8 chiffres',
    numberOfBids: 'Nombre d\'Enchères',
    orEnterCustom: 'Ou entrez un montant personnalisé',
    available: 'Disponible',
    messageOptional: 'Message (optionnel)',
    messagePlaceholder: 'ex. Joyeux anniversaire! 🎉',
    sendGift: 'Envoyer le Cadeau',
    sending: 'Envoi en cours...',
    sent: 'Envoyé',
    received: 'Reçu',
    giftsGiven: 'Enchères offertes',
    giftsReceived: 'Enchères reçues',
    sentGifts: 'Cadeaux Envoyés',
    receivedGifts: 'Cadeaux Reçus',
    to: 'À',
    from: 'De',
    noSentGifts: 'Aucun cadeau envoyé',
    noReceivedGifts: 'Aucun cadeau reçu',
    recipientFound: 'Destinataire trouvé',
    customerNumberLabel: 'Numéro Client',
    login: 'Connexion',
    loginToGift: 'Connectez-vous pour offrir des enchères',
    copied: 'Copié!',
    notFound: 'Numéro client introuvable',
    notEnoughBids: 'Pas assez d\'enchères',
    minOneBid: 'Minimum 1 enchère requise',
    searchFirst: 'Veuillez d\'abord rechercher un destinataire',
    enterValidNumber: 'Veuillez entrer un numéro client à 8 chiffres valide',
    enterValidAmount: 'Veuillez entrer un montant valide'
  },
  sq: {
    title: 'Dhuro Oferta',
    subtitle: 'Dhuroni oferta miqve dhe familjes tuaj!',
    yourCustomerNumber: 'Numri Juaj i Klientit',
    shareNumber: 'Ndani këtë numër me miqtë tuaj që ata të mund të ju dhurojnë oferta',
    yourBalance: 'Bilanci Juaj',
    bids: 'Oferta',
    sendBids: 'Dërgo Oferta',
    history: 'Historia',
    giftBids: 'Dhuro Oferta',
    findRecipient: 'Gjej Marrësin',
    enterCustomerNumber: 'Fut numrin 8-shifror të klientit',
    numberOfBids: 'Numri i Ofertave',
    orEnterCustom: 'Ose fut sasi të personalizuar',
    available: 'Në dispozicion',
    messageOptional: 'Mesazh (opsional)',
    messagePlaceholder: 'p.sh. Gëzuar ditëlindjen! 🎉',
    sendGift: 'Dërgo Dhuratën',
    sending: 'Duke dërguar...',
    sent: 'Dërguar',
    received: 'Marrë',
    giftsGiven: 'Oferta të dhuruara',
    giftsReceived: 'Oferta të marra',
    sentGifts: 'Dhurata të Dërguara',
    receivedGifts: 'Dhurata të Marra',
    to: 'Për',
    from: 'Nga',
    noSentGifts: 'Ende pa dhurata të dërguara',
    noReceivedGifts: 'Ende pa dhurata të marra',
    recipientFound: 'Marrësi u gjet',
    customerNumberLabel: 'Numri i Klientit',
    login: 'Hyr',
    loginToGift: 'Hyni për të dhuruar oferta',
    copied: 'Kopjuar!',
    notFound: 'Numri i klientit nuk u gjet',
    notEnoughBids: 'Jo mjaftueshëm oferta',
    minOneBid: 'Minimum 1 ofertë e nevojshme',
    searchFirst: 'Ju lutem kërkoni së pari një marrës',
    enterValidNumber: 'Ju lutem fusni numër të vlefshëm 8-shifror',
    enterValidAmount: 'Ju lutem fusni sasi të vlefshme'
  },
  xk: {
    title: 'Dhuro Oferta', subtitle: 'Dhuroni oferta miqve dhe familjes tuaj!', yourCustomerNumber: 'Numri Juaj i Klientit', shareNumber: 'Ndani këtë numër me miqtë tuaj që ata të mund të ju dhurojnë oferta', yourBalance: 'Bilanci Juaj', bids: 'Oferta', sendBids: 'Dërgo Oferta', history: 'Historia', giftBids: 'Dhuro Oferta', findRecipient: 'Gjej Marrësin', enterCustomerNumber: 'Fut numrin 8-shifror të klientit', numberOfBids: 'Numri i Ofertave', orEnterCustom: 'Ose fut sasi të personalizuar', available: 'Në dispozicion', messageOptional: 'Mesazh (opsional)', messagePlaceholder: 'p.sh. Gëzuar ditëlindjen! 🎉', sendGift: 'Dërgo Dhuratën', sending: 'Duke dërguar...', sent: 'Dërguar', received: 'Marrë', giftsGiven: 'Oferta të dhuruara', giftsReceived: 'Oferta të marra', sentGifts: 'Dhurata të Dërguara', receivedGifts: 'Dhurata të Marra', to: 'Për', from: 'Nga', noSentGifts: 'Ende pa dhurata të dërguara', noReceivedGifts: 'Ende pa dhurata të marra', recipientFound: 'Marrësi u gjet', customerNumberLabel: 'Numri i Klientit', login: 'Hyr', loginToGift: 'Hyni për të dhuruar oferta', copied: 'Kopjuar!', notFound: 'Numri i klientit nuk u gjet', notEnoughBids: 'Jo mjaftueshëm oferta', minOneBid: 'Minimum 1 ofertë e nevojshme', searchFirst: 'Ju lutem kërkoni së pari një marrës', enterValidNumber: 'Ju lutem fusni numër të vlefshëm 8-shifror', enterValidAmount: 'Ju lutem fusni sasi të vlefshme'
  },
  us: {
    title: 'Gift Bids', subtitle: 'Gift bids to your friends and family!', yourCustomerNumber: 'Your Customer Number', shareNumber: 'Share this number with friends so they can gift you bids', yourBalance: 'Your Balance', bids: 'Bids', sendBids: 'Send Bids', history: 'History', giftBids: 'Gift Bids', findRecipient: 'Find Recipient', enterCustomerNumber: 'Enter 8-digit customer number', numberOfBids: 'Number of Bids', orEnterCustom: 'Or enter custom amount', available: 'Available', messageOptional: 'Message (optional)', messagePlaceholder: 'e.g. Happy Birthday! 🎉', sendGift: 'Send Gift', sending: 'Sending...', sent: 'Sent', received: 'Received', giftsGiven: 'Bids gifted', giftsReceived: 'Bids received', sentGifts: 'Sent Gifts', receivedGifts: 'Received Gifts', to: 'To', from: 'From', noSentGifts: 'No gifts sent yet', noReceivedGifts: 'No gifts received yet', recipientFound: 'Recipient found', customerNumberLabel: 'Customer Number', login: 'Login', loginToGift: 'Please login to gift bids', copied: 'Copied!', notFound: 'Customer number not found', notEnoughBids: 'Not enough bids available', minOneBid: 'Minimum 1 bid required', searchFirst: 'Please search for a recipient first', enterValidNumber: 'Please enter a valid 8-digit customer number', enterValidAmount: 'Please enter a valid amount'
  },
  es: {
    title: 'Regalar Pujas', subtitle: '¡Regala pujas a tus amigos y familia!', yourCustomerNumber: 'Tu Número de Cliente', shareNumber: 'Comparte este número con amigos para que puedan regalarte pujas', yourBalance: 'Tu Saldo', bids: 'Pujas', sendBids: 'Enviar Pujas', history: 'Historial', giftBids: 'Regalar Pujas', findRecipient: 'Buscar Destinatario', enterCustomerNumber: 'Ingresa número de cliente de 8 dígitos', numberOfBids: 'Número de Pujas', orEnterCustom: 'O ingresa cantidad personalizada', available: 'Disponible', messageOptional: 'Mensaje (opcional)', messagePlaceholder: 'ej. ¡Feliz cumpleaños! 🎉', sendGift: 'Enviar Regalo', sending: 'Enviando...', sent: 'Enviado', received: 'Recibido', giftsGiven: 'Pujas regaladas', giftsReceived: 'Pujas recibidas', sentGifts: 'Regalos Enviados', receivedGifts: 'Regalos Recibidos', to: 'Para', from: 'De', noSentGifts: 'No hay regalos enviados', noReceivedGifts: 'No hay regalos recibidos', recipientFound: 'Destinatario encontrado', customerNumberLabel: 'Número de Cliente', login: 'Iniciar sesión', loginToGift: 'Inicia sesión para regalar pujas', copied: '¡Copiado!', notFound: 'Número de cliente no encontrado', notEnoughBids: 'No hay suficientes pujas', minOneBid: 'Mínimo 1 puja requerida', searchFirst: 'Busca primero un destinatario', enterValidNumber: 'Ingresa un número de cliente de 8 dígitos válido', enterValidAmount: 'Ingresa una cantidad válida'
  },
  it: {
    title: 'Regala Offerte', subtitle: 'Regala offerte ad amici e familiari!', yourCustomerNumber: 'Il Tuo Numero Cliente', shareNumber: 'Condividi questo numero con gli amici per ricevere offerte in regalo', yourBalance: 'Il Tuo Saldo', bids: 'Offerte', sendBids: 'Invia Offerte', history: 'Cronologia', giftBids: 'Regala Offerte', findRecipient: 'Trova Destinatario', enterCustomerNumber: 'Inserisci numero cliente a 8 cifre', numberOfBids: 'Numero di Offerte', orEnterCustom: 'O inserisci importo personalizzato', available: 'Disponibile', messageOptional: 'Messaggio (opzionale)', messagePlaceholder: 'es. Buon compleanno! 🎉', sendGift: 'Invia Regalo', sending: 'Invio in corso...', sent: 'Inviato', received: 'Ricevuto', giftsGiven: 'Offerte regalate', giftsReceived: 'Offerte ricevute', sentGifts: 'Regali Inviati', receivedGifts: 'Regali Ricevuti', to: 'A', from: 'Da', noSentGifts: 'Nessun regalo inviato', noReceivedGifts: 'Nessun regalo ricevuto', recipientFound: 'Destinatario trovato', customerNumberLabel: 'Numero Cliente', login: 'Accedi', loginToGift: 'Accedi per regalare offerte', copied: 'Copiato!', notFound: 'Numero cliente non trovato', notEnoughBids: 'Offerte insufficienti', minOneBid: 'Minimo 1 offerta richiesta', searchFirst: 'Cerca prima un destinatario', enterValidNumber: 'Inserisci un numero cliente a 8 cifre valido', enterValidAmount: 'Inserisci un importo valido'
  },
  pt: {
    title: 'Presentear Lances', subtitle: 'Presenteie lances para amigos e família!', yourCustomerNumber: 'Seu Número de Cliente', shareNumber: 'Compartilhe este número com amigos para que possam te presentear lances', yourBalance: 'Seu Saldo', bids: 'Lances', sendBids: 'Enviar Lances', history: 'Histórico', giftBids: 'Presentear Lances', findRecipient: 'Encontrar Destinatário', enterCustomerNumber: 'Digite número de cliente de 8 dígitos', numberOfBids: 'Número de Lances', orEnterCustom: 'Ou digite quantidade personalizada', available: 'Disponível', messageOptional: 'Mensagem (opcional)', messagePlaceholder: 'ex. Feliz aniversário! 🎉', sendGift: 'Enviar Presente', sending: 'Enviando...', sent: 'Enviado', received: 'Recebido', giftsGiven: 'Lances presenteados', giftsReceived: 'Lances recebidos', sentGifts: 'Presentes Enviados', receivedGifts: 'Presentes Recebidos', to: 'Para', from: 'De', noSentGifts: 'Nenhum presente enviado', noReceivedGifts: 'Nenhum presente recebido', recipientFound: 'Destinatário encontrado', customerNumberLabel: 'Número de Cliente', login: 'Entrar', loginToGift: 'Entre para presentear lances', copied: 'Copiado!', notFound: 'Número de cliente não encontrado', notEnoughBids: 'Lances insuficientes', minOneBid: 'Mínimo 1 lance necessário', searchFirst: 'Procure primeiro um destinatário', enterValidNumber: 'Digite um número de cliente de 8 dígitos válido', enterValidAmount: 'Digite uma quantidade válida'
  },
  nl: {
    title: 'Biedingen Cadeau Geven', subtitle: 'Geef biedingen cadeau aan vrienden en familie!', yourCustomerNumber: 'Jouw Klantnummer', shareNumber: 'Deel dit nummer met vrienden zodat ze je biedingen kunnen cadeau geven', yourBalance: 'Jouw Saldo', bids: 'Biedingen', sendBids: 'Biedingen Verzenden', history: 'Geschiedenis', giftBids: 'Biedingen Cadeau Geven', findRecipient: 'Ontvanger Zoeken', enterCustomerNumber: 'Voer 8-cijferig klantnummer in', numberOfBids: 'Aantal Biedingen', orEnterCustom: 'Of voer aangepaste hoeveelheid in', available: 'Beschikbaar', messageOptional: 'Bericht (optioneel)', messagePlaceholder: 'bijv. Fijne verjaardag! 🎉', sendGift: 'Cadeau Verzenden', sending: 'Verzenden...', sent: 'Verzonden', received: 'Ontvangen', giftsGiven: 'Biedingen gegeven', giftsReceived: 'Biedingen ontvangen', sentGifts: 'Verzonden Cadeaus', receivedGifts: 'Ontvangen Cadeaus', to: 'Aan', from: 'Van', noSentGifts: 'Nog geen cadeaus verzonden', noReceivedGifts: 'Nog geen cadeaus ontvangen', recipientFound: 'Ontvanger gevonden', customerNumberLabel: 'Klantnummer', login: 'Inloggen', loginToGift: 'Log in om biedingen cadeau te geven', copied: 'Gekopieerd!', notFound: 'Klantnummer niet gevonden', notEnoughBids: 'Niet genoeg biedingen', minOneBid: 'Minimaal 1 bieding vereist', searchFirst: 'Zoek eerst een ontvanger', enterValidNumber: 'Voer een geldig 8-cijferig klantnummer in', enterValidAmount: 'Voer een geldige hoeveelheid in'
  },
  pl: {
    title: 'Podaruj Oferty', subtitle: 'Podaruj oferty znajomym i rodzinie!', yourCustomerNumber: 'Twój Numer Klienta', shareNumber: 'Podziel się tym numerem ze znajomymi, aby mogli Ci podarować oferty', yourBalance: 'Twoje Saldo', bids: 'Oferty', sendBids: 'Wyślij Oferty', history: 'Historia', giftBids: 'Podaruj Oferty', findRecipient: 'Znajdź Odbiorcę', enterCustomerNumber: 'Wpisz 8-cyfrowy numer klienta', numberOfBids: 'Liczba Ofert', orEnterCustom: 'Lub wpisz własną ilość', available: 'Dostępne', messageOptional: 'Wiadomość (opcjonalnie)', messagePlaceholder: 'np. Wszystkiego najlepszego! 🎉', sendGift: 'Wyślij Prezent', sending: 'Wysyłanie...', sent: 'Wysłane', received: 'Otrzymane', giftsGiven: 'Podarowane oferty', giftsReceived: 'Otrzymane oferty', sentGifts: 'Wysłane Prezenty', receivedGifts: 'Otrzymane Prezenty', to: 'Do', from: 'Od', noSentGifts: 'Brak wysłanych prezentów', noReceivedGifts: 'Brak otrzymanych prezentów', recipientFound: 'Odbiorca znaleziony', customerNumberLabel: 'Numer Klienta', login: 'Zaloguj się', loginToGift: 'Zaloguj się, aby podarować oferty', copied: 'Skopiowano!', notFound: 'Numer klienta nie znaleziony', notEnoughBids: 'Niewystarczająca liczba ofert', minOneBid: 'Wymagana minimum 1 oferta', searchFirst: 'Najpierw wyszukaj odbiorcę', enterValidNumber: 'Wpisz prawidłowy 8-cyfrowy numer klienta', enterValidAmount: 'Wpisz prawidłową ilość'
  },
  ru: {
    title: 'Подарить Ставки', subtitle: 'Подарите ставки друзьям и семье!', yourCustomerNumber: 'Ваш Номер Клиента', shareNumber: 'Поделитесь этим номером с друзьями, чтобы они могли подарить вам ставки', yourBalance: 'Ваш Баланс', bids: 'Ставки', sendBids: 'Отправить Ставки', history: 'История', giftBids: 'Подарить Ставки', findRecipient: 'Найти Получателя', enterCustomerNumber: 'Введите 8-значный номер клиента', numberOfBids: 'Количество Ставок', orEnterCustom: 'Или введите свою сумму', available: 'Доступно', messageOptional: 'Сообщение (необязательно)', messagePlaceholder: 'напр. С днём рождения! 🎉', sendGift: 'Отправить Подарок', sending: 'Отправка...', sent: 'Отправлено', received: 'Получено', giftsGiven: 'Подаренные ставки', giftsReceived: 'Полученные ставки', sentGifts: 'Отправленные Подарки', receivedGifts: 'Полученные Подарки', to: 'Кому', from: 'От', noSentGifts: 'Подарки ещё не отправлены', noReceivedGifts: 'Подарки ещё не получены', recipientFound: 'Получатель найден', customerNumberLabel: 'Номер Клиента', login: 'Войти', loginToGift: 'Войдите, чтобы подарить ставки', copied: 'Скопировано!', notFound: 'Номер клиента не найден', notEnoughBids: 'Недостаточно ставок', minOneBid: 'Требуется минимум 1 ставка', searchFirst: 'Сначала найдите получателя', enterValidNumber: 'Введите правильный 8-значный номер клиента', enterValidAmount: 'Введите правильную сумму'
  },
  ar: {
    title: 'إهداء العروض', subtitle: 'أهدِ العروض لأصدقائك وعائلتك!', yourCustomerNumber: 'رقم العميل الخاص بك', shareNumber: 'شارك هذا الرقم مع الأصدقاء ليتمكنوا من إهدائك عروض', yourBalance: 'رصيدك', bids: 'العروض', sendBids: 'إرسال العروض', history: 'السجل', giftBids: 'إهداء العروض', findRecipient: 'البحث عن المستلم', enterCustomerNumber: 'أدخل رقم العميل المكون من 8 أرقام', numberOfBids: 'عدد العروض', orEnterCustom: 'أو أدخل كمية مخصصة', available: 'متاح', messageOptional: 'رسالة (اختياري)', messagePlaceholder: 'مثال: عيد ميلاد سعيد! 🎉', sendGift: 'إرسال الهدية', sending: 'جاري الإرسال...', sent: 'تم الإرسال', received: 'تم الاستلام', giftsGiven: 'العروض المهداة', giftsReceived: 'العروض المستلمة', sentGifts: 'الهدايا المرسلة', receivedGifts: 'الهدايا المستلمة', to: 'إلى', from: 'من', noSentGifts: 'لم يتم إرسال هدايا بعد', noReceivedGifts: 'لم يتم استلام هدايا بعد', recipientFound: 'تم العثور على المستلم', customerNumberLabel: 'رقم العميل', login: 'تسجيل الدخول', loginToGift: 'سجل الدخول لإهداء العروض', copied: 'تم النسخ!', notFound: 'رقم العميل غير موجود', notEnoughBids: 'لا يوجد عروض كافية', minOneBid: 'مطلوب عرض واحد على الأقل', searchFirst: 'ابحث أولاً عن مستلم', enterValidNumber: 'أدخل رقم عميل صالح مكون من 8 أرقام', enterValidAmount: 'أدخل كمية صالحة'
  },
  ae: {
    title: 'إهداء العروض', subtitle: 'أهدِ العروض لأصدقائك وعائلتك!', yourCustomerNumber: 'رقم العميل الخاص بك', shareNumber: 'شارك هذا الرقم مع الأصدقاء ليتمكنوا من إهدائك عروض', yourBalance: 'رصيدك', bids: 'العروض', sendBids: 'إرسال العروض', history: 'السجل', giftBids: 'إهداء العروض', findRecipient: 'البحث عن المستلم', enterCustomerNumber: 'أدخل رقم العميل المكون من 8 أرقام', numberOfBids: 'عدد العروض', orEnterCustom: 'أو أدخل كمية مخصصة', available: 'متاح', messageOptional: 'رسالة (اختياري)', messagePlaceholder: 'مثال: عيد ميلاد سعيد! 🎉', sendGift: 'إرسال الهدية', sending: 'جاري الإرسال...', sent: 'تم الإرسال', received: 'تم الاستلام', giftsGiven: 'العروض المهداة', giftsReceived: 'العروض المستلمة', sentGifts: 'الهدايا المرسلة', receivedGifts: 'الهدايا المستلمة', to: 'إلى', from: 'من', noSentGifts: 'لم يتم إرسال هدايا بعد', noReceivedGifts: 'لم يتم استلام هدايا بعد', recipientFound: 'تم العثور على المستلم', customerNumberLabel: 'رقم العميل', login: 'تسجيل الدخول', loginToGift: 'سجل الدخول لإهداء العروض', copied: 'تم النسخ!', notFound: 'رقم العميل غير موجود', notEnoughBids: 'لا يوجد عروض كافية', minOneBid: 'مطلوب عرض واحد على الأقل', searchFirst: 'ابحث أولاً عن مستلم', enterValidNumber: 'أدخل رقم عميل صالح مكون من 8 أرقام', enterValidAmount: 'أدخل كمية صالحة'
  },
  zh: {
    title: '赠送出价', subtitle: '将出价赠送给朋友和家人！', yourCustomerNumber: '您的客户编号', shareNumber: '与朋友分享此编号，以便他们向您赠送出价', yourBalance: '您的余额', bids: '出价', sendBids: '发送出价', history: '历史', giftBids: '赠送出价', findRecipient: '查找收件人', enterCustomerNumber: '输入8位客户编号', numberOfBids: '出价数量', orEnterCustom: '或输入自定义数量', available: '可用', messageOptional: '留言（可选）', messagePlaceholder: '例如：生日快乐！🎉', sendGift: '发送礼物', sending: '发送中...', sent: '已发送', received: '已收到', giftsGiven: '已赠送出价', giftsReceived: '已收到出价', sentGifts: '已发送礼物', receivedGifts: '已收到礼物', to: '给', from: '来自', noSentGifts: '尚未发送礼物', noReceivedGifts: '尚未收到礼物', recipientFound: '找到收件人', customerNumberLabel: '客户编号', login: '登录', loginToGift: '请登录以赠送出价', copied: '已复制！', notFound: '未找到客户编号', notEnoughBids: '出价不足', minOneBid: '至少需要1个出价', searchFirst: '请先搜索收件人', enterValidNumber: '请输入有效的8位客户编号', enterValidAmount: '请输入有效数量'
  },
  ja: {
    title: '入札をプレゼント', subtitle: '友人や家族に入札をプレゼント！', yourCustomerNumber: 'お客様番号', shareNumber: '友人とこの番号を共有して入札をプレゼントしてもらおう', yourBalance: '残高', bids: '入札', sendBids: '入札を送信', history: '履歴', giftBids: '入札をプレゼント', findRecipient: '受取人を検索', enterCustomerNumber: '8桁のお客様番号を入力', numberOfBids: '入札数', orEnterCustom: 'または任意の数量を入力', available: '利用可能', messageOptional: 'メッセージ（任意）', messagePlaceholder: '例：お誕生日おめでとう！🎉', sendGift: 'プレゼントを送る', sending: '送信中...', sent: '送信済み', received: '受信済み', giftsGiven: 'プレゼントした入札', giftsReceived: '受け取った入札', sentGifts: '送ったプレゼント', receivedGifts: '受け取ったプレゼント', to: '宛先', from: '送信者', noSentGifts: 'まだプレゼントを送っていません', noReceivedGifts: 'まだプレゼントを受け取っていません', recipientFound: '受取人が見つかりました', customerNumberLabel: 'お客様番号', login: 'ログイン', loginToGift: 'ログインして入札をプレゼント', copied: 'コピー完了！', notFound: 'お客様番号が見つかりません', notEnoughBids: '入札が不足しています', minOneBid: '最低1入札必要', searchFirst: '先に受取人を検索してください', enterValidNumber: '有効な8桁のお客様番号を入力してください', enterValidAmount: '有効な数量を入力してください'
  },
  ko: {
    title: '입찰 선물하기', subtitle: '친구와 가족에게 입찰을 선물하세요!', yourCustomerNumber: '고객 번호', shareNumber: '이 번호를 친구와 공유하여 입찰을 선물 받으세요', yourBalance: '잔액', bids: '입찰', sendBids: '입찰 보내기', history: '기록', giftBids: '입찰 선물하기', findRecipient: '수신자 찾기', enterCustomerNumber: '8자리 고객 번호 입력', numberOfBids: '입찰 수', orEnterCustom: '또는 사용자 정의 수량 입력', available: '사용 가능', messageOptional: '메시지 (선택)', messagePlaceholder: '예: 생일 축하해요! 🎉', sendGift: '선물 보내기', sending: '보내는 중...', sent: '보냄', received: '받음', giftsGiven: '선물한 입찰', giftsReceived: '받은 입찰', sentGifts: '보낸 선물', receivedGifts: '받은 선물', to: '받는 사람', from: '보낸 사람', noSentGifts: '아직 보낸 선물 없음', noReceivedGifts: '아직 받은 선물 없음', recipientFound: '수신자 찾음', customerNumberLabel: '고객 번호', login: '로그인', loginToGift: '로그인하여 입찰 선물하기', copied: '복사됨!', notFound: '고객 번호를 찾을 수 없음', notEnoughBids: '입찰 부족', minOneBid: '최소 1개 입찰 필요', searchFirst: '먼저 수신자를 검색하세요', enterValidNumber: '유효한 8자리 고객 번호를 입력하세요', enterValidAmount: '유효한 수량을 입력하세요'
  },
  hi: {
    title: 'बोलियां उपहार दें', subtitle: 'दोस्तों और परिवार को बोलियां उपहार दें!', yourCustomerNumber: 'आपका ग्राहक नंबर', shareNumber: 'इस नंबर को दोस्तों के साथ साझा करें ताकि वे आपको बोलियां उपहार दे सकें', yourBalance: 'आपका बैलेंस', bids: 'बोलियां', sendBids: 'बोलियां भेजें', history: 'इतिहास', giftBids: 'बोलियां उपहार दें', findRecipient: 'प्राप्तकर्ता खोजें', enterCustomerNumber: '8-अंकीय ग्राहक नंबर दर्ज करें', numberOfBids: 'बोलियों की संख्या', orEnterCustom: 'या कस्टम राशि दर्ज करें', available: 'उपलब्ध', messageOptional: 'संदेश (वैकल्पिक)', messagePlaceholder: 'जैसे: जन्मदिन मुबारक! 🎉', sendGift: 'उपहार भेजें', sending: 'भेज रहे हैं...', sent: 'भेजा गया', received: 'प्राप्त', giftsGiven: 'दी गई बोलियां', giftsReceived: 'प्राप्त बोलियां', sentGifts: 'भेजे गए उपहार', receivedGifts: 'प्राप्त उपहार', to: 'को', from: 'से', noSentGifts: 'अभी तक कोई उपहार नहीं भेजा', noReceivedGifts: 'अभी तक कोई उपहार नहीं मिला', recipientFound: 'प्राप्तकर्ता मिला', customerNumberLabel: 'ग्राहक नंबर', login: 'लॉगिन', loginToGift: 'बोलियां उपहार देने के लिए लॉगिन करें', copied: 'कॉपी किया!', notFound: 'ग्राहक नंबर नहीं मिला', notEnoughBids: 'पर्याप्त बोलियां नहीं', minOneBid: 'न्यूनतम 1 बोली आवश्यक', searchFirst: 'पहले प्राप्तकर्ता खोजें', enterValidNumber: 'वैध 8-अंकीय ग्राहक नंबर दर्ज करें', enterValidAmount: 'वैध राशि दर्ज करें'
  },
  cs: {
    title: 'Darovat nabídky', subtitle: 'Darujte nabídky přátelům a rodině!', yourCustomerNumber: 'Vaše zákaznické číslo', shareNumber: 'Sdílejte toto číslo s přáteli, aby vám mohli darovat nabídky', yourBalance: 'Váš zůstatek', bids: 'Nabídky', sendBids: 'Odeslat nabídky', history: 'Historie', giftBids: 'Darovat nabídky', findRecipient: 'Najít příjemce', enterCustomerNumber: 'Zadejte 8místné zákaznické číslo', numberOfBids: 'Počet nabídek', orEnterCustom: 'Nebo zadejte vlastní množství', available: 'Dostupné', messageOptional: 'Zpráva (volitelné)', messagePlaceholder: 'např. Vše nejlepší! 🎉', sendGift: 'Odeslat dárek', sending: 'Odesílání...', sent: 'Odesláno', received: 'Přijato', giftsGiven: 'Darované nabídky', giftsReceived: 'Přijaté nabídky', sentGifts: 'Odeslané dárky', receivedGifts: 'Přijaté dárky', to: 'Komu', from: 'Od', noSentGifts: 'Zatím neodeslané dárky', noReceivedGifts: 'Zatím nepřijaté dárky', recipientFound: 'Příjemce nalezen', customerNumberLabel: 'Zákaznické číslo', login: 'Přihlásit', loginToGift: 'Přihlaste se pro darování nabídek', copied: 'Zkopírováno!', notFound: 'Zákaznické číslo nenalezeno', notEnoughBids: 'Nedostatek nabídek', minOneBid: 'Vyžadována minimálně 1 nabídka', searchFirst: 'Nejprve vyhledejte příjemce', enterValidNumber: 'Zadejte platné 8místné zákaznické číslo', enterValidAmount: 'Zadejte platné množství'
  },
  sv: {
    title: 'Ge bort bud', subtitle: 'Ge bort bud till vänner och familj!', yourCustomerNumber: 'Ditt kundnummer', shareNumber: 'Dela detta nummer med vänner så att de kan ge dig bud', yourBalance: 'Ditt saldo', bids: 'Bud', sendBids: 'Skicka bud', history: 'Historik', giftBids: 'Ge bort bud', findRecipient: 'Hitta mottagare', enterCustomerNumber: 'Ange 8-siffrigt kundnummer', numberOfBids: 'Antal bud', orEnterCustom: 'Eller ange egen mängd', available: 'Tillgängligt', messageOptional: 'Meddelande (valfritt)', messagePlaceholder: 't.ex. Grattis på födelsedagen! 🎉', sendGift: 'Skicka present', sending: 'Skickar...', sent: 'Skickat', received: 'Mottaget', giftsGiven: 'Givna bud', giftsReceived: 'Mottagna bud', sentGifts: 'Skickade presenter', receivedGifts: 'Mottagna presenter', to: 'Till', from: 'Från', noSentGifts: 'Inga presenter skickade ännu', noReceivedGifts: 'Inga presenter mottagna ännu', recipientFound: 'Mottagare hittad', customerNumberLabel: 'Kundnummer', login: 'Logga in', loginToGift: 'Logga in för att ge bort bud', copied: 'Kopierat!', notFound: 'Kundnummer hittades inte', notEnoughBids: 'Inte tillräckligt med bud', minOneBid: 'Minst 1 bud krävs', searchFirst: 'Sök först efter en mottagare', enterValidNumber: 'Ange ett giltigt 8-siffrigt kundnummer', enterValidAmount: 'Ange en giltig mängd'
  },
  da: {
    title: 'Giv bud væk', subtitle: 'Giv bud væk til venner og familie!', yourCustomerNumber: 'Dit kundenummer', shareNumber: 'Del dette nummer med venner, så de kan give dig bud', yourBalance: 'Din saldo', bids: 'Bud', sendBids: 'Send bud', history: 'Historik', giftBids: 'Giv bud væk', findRecipient: 'Find modtager', enterCustomerNumber: 'Indtast 8-cifret kundenummer', numberOfBids: 'Antal bud', orEnterCustom: 'Eller indtast eget antal', available: 'Tilgængeligt', messageOptional: 'Besked (valgfrit)', messagePlaceholder: 'f.eks. Tillykke med fødselsdagen! 🎉', sendGift: 'Send gave', sending: 'Sender...', sent: 'Sendt', received: 'Modtaget', giftsGiven: 'Givne bud', giftsReceived: 'Modtagne bud', sentGifts: 'Sendte gaver', receivedGifts: 'Modtagne gaver', to: 'Til', from: 'Fra', noSentGifts: 'Ingen gaver sendt endnu', noReceivedGifts: 'Ingen gaver modtaget endnu', recipientFound: 'Modtager fundet', customerNumberLabel: 'Kundenummer', login: 'Log ind', loginToGift: 'Log ind for at give bud væk', copied: 'Kopieret!', notFound: 'Kundenummer ikke fundet', notEnoughBids: 'Ikke nok bud', minOneBid: 'Mindst 1 bud krævet', searchFirst: 'Søg først efter en modtager', enterValidNumber: 'Indtast et gyldigt 8-cifret kundenummer', enterValidAmount: 'Indtast et gyldigt antal'
  },
  fi: {
    title: 'Lahjoita tarjouksia', subtitle: 'Lahjoita tarjouksia ystäville ja perheelle!', yourCustomerNumber: 'Asiakasnumerosi', shareNumber: 'Jaa tämä numero ystävien kanssa, jotta he voivat lahjoittaa sinulle tarjouksia', yourBalance: 'Saldosi', bids: 'Tarjoukset', sendBids: 'Lähetä tarjouksia', history: 'Historia', giftBids: 'Lahjoita tarjouksia', findRecipient: 'Etsi vastaanottaja', enterCustomerNumber: 'Syötä 8-numeroinen asiakasnumero', numberOfBids: 'Tarjousten määrä', orEnterCustom: 'Tai syötä oma määrä', available: 'Saatavilla', messageOptional: 'Viesti (valinnainen)', messagePlaceholder: 'esim. Hyvää syntymäpäivää! 🎉', sendGift: 'Lähetä lahja', sending: 'Lähetetään...', sent: 'Lähetetty', received: 'Vastaanotettu', giftsGiven: 'Lahjoitetut tarjoukset', giftsReceived: 'Vastaanotetut tarjoukset', sentGifts: 'Lähetetyt lahjat', receivedGifts: 'Vastaanotetut lahjat', to: 'Vastaanottaja', from: 'Lähettäjä', noSentGifts: 'Ei vielä lähetettyjä lahjoja', noReceivedGifts: 'Ei vielä vastaanotettuja lahjoja', recipientFound: 'Vastaanottaja löytyi', customerNumberLabel: 'Asiakasnumero', login: 'Kirjaudu', loginToGift: 'Kirjaudu lahjoittaaksesi tarjouksia', copied: 'Kopioitu!', notFound: 'Asiakasnumeroa ei löytynyt', notEnoughBids: 'Tarjouksia ei ole tarpeeksi', minOneBid: 'Vähintään 1 tarjous vaaditaan', searchFirst: 'Etsi ensin vastaanottaja', enterValidNumber: 'Syötä kelvollinen 8-numeroinen asiakasnumero', enterValidAmount: 'Syötä kelvollinen määrä'
  },
  el: {
    title: 'Δωρίστε Προσφορές', subtitle: 'Δωρίστε προσφορές σε φίλους και οικογένεια!', yourCustomerNumber: 'Ο Αριθμός Πελάτη σας', shareNumber: 'Μοιραστείτε αυτόν τον αριθμό με φίλους για να σας δωρίσουν προσφορές', yourBalance: 'Το Υπόλοιπό σας', bids: 'Προσφορές', sendBids: 'Αποστολή Προσφορών', history: 'Ιστορικό', giftBids: 'Δωρίστε Προσφορές', findRecipient: 'Εύρεση Παραλήπτη', enterCustomerNumber: 'Εισάγετε 8ψήφιο αριθμό πελάτη', numberOfBids: 'Αριθμός Προσφορών', orEnterCustom: 'Ή εισάγετε προσαρμοσμένη ποσότητα', available: 'Διαθέσιμο', messageOptional: 'Μήνυμα (προαιρετικό)', messagePlaceholder: 'π.χ. Χρόνια πολλά! 🎉', sendGift: 'Αποστολή Δώρου', sending: 'Αποστέλλεται...', sent: 'Απεστάλη', received: 'Ελήφθη', giftsGiven: 'Δωρισμένες προσφορές', giftsReceived: 'Ληφθείσες προσφορές', sentGifts: 'Απεσταλμένα Δώρα', receivedGifts: 'Ληφθέντα Δώρα', to: 'Προς', from: 'Από', noSentGifts: 'Δεν έχουν σταλεί δώρα ακόμα', noReceivedGifts: 'Δεν έχουν ληφθεί δώρα ακόμα', recipientFound: 'Παραλήπτης βρέθηκε', customerNumberLabel: 'Αριθμός Πελάτη', login: 'Σύνδεση', loginToGift: 'Συνδεθείτε για να δωρίσετε προσφορές', copied: 'Αντιγράφηκε!', notFound: 'Ο αριθμός πελάτη δεν βρέθηκε', notEnoughBids: 'Δεν υπάρχουν αρκετές προσφορές', minOneBid: 'Απαιτείται τουλάχιστον 1 προσφορά', searchFirst: 'Αναζητήστε πρώτα έναν παραλήπτη', enterValidNumber: 'Εισάγετε έγκυρο 8ψήφιο αριθμό πελάτη', enterValidAmount: 'Εισάγετε έγκυρη ποσότητα'
  }
};

export default function GiftBids() {
  const { user, token, updateBidsBalance } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;
  
  const [customerNumber, setCustomerNumber] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [recipientInfo, setRecipientInfo] = useState(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState({ sent: [], received: [], total_sent: 0, total_received: 0 });
  const [activeTab, setActiveTab] = useState('send');

  useEffect(() => {
    if (token) {
      fetchCustomerNumber();
      fetchHistory();
    }
  }, [token]);

  const fetchCustomerNumber = async () => {
    try {
      const response = await axios.get(`${API}/gifts/my-customer-number`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomerNumber(response.data.customer_number);
    } catch (error) {
      console.error('Error fetching customer number:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/gifts/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const lookupRecipient = async () => {
    if (!recipientNumber || recipientNumber.length < 8) {
      toast.error(t.enterValidNumber);
      return;
    }

    setLookupLoading(true);
    try {
      const response = await axios.get(`${API}/gifts/lookup/${recipientNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecipientInfo(response.data);
      toast.success(`${t.recipientFound}: ${response.data.name}`);
    } catch (error) {
      setRecipientInfo(null);
      toast.error(error.response?.data?.detail || t.notFound);
    } finally {
      setLookupLoading(false);
    }
  };

  const sendGift = async () => {
    const amount = parseInt(giftAmount);
    if (!amount || amount < 1) {
      toast.error(t.enterValidAmount);
      return;
    }

    if (amount > (user?.bids_balance || 0)) {
      toast.error(t.notEnoughBids);
      return;
    }

    if (!recipientInfo) {
      toast.error(t.searchFirst);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/gifts/send`, {
        recipient_customer_number: recipientNumber,
        amount: amount,
        message: giftMessage || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        updateBidsBalance(response.data.new_balance);
        setRecipientNumber('');
        setRecipientInfo(null);
        setGiftAmount('');
        setGiftMessage('');
        fetchHistory();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t.notFound);
    } finally {
      setLoading(false);
    }
  };

  const copyCustomerNumber = () => {
    navigator.clipboard.writeText(customerNumber);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!token) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <Gift className="w-16 h-16 text-pink-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{t.title}</h1>
          <p className="text-gray-500 mb-6">{t.loginToGift}</p>
          <Button onClick={() => window.location.href = '/login'} className="bg-pink-500 hover:bg-pink-600">
            {t.login}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="gift-bids-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Customer Number Card */}
        <div className="glass-card rounded-xl p-6 mb-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.yourCustomerNumber}</p>
              <div className="flex items-center gap-3">
                <code className="text-3xl font-bold text-cyan-400 tracking-wider">{customerNumber || '--------'}</code>
                <button 
                  onClick={copyCustomerNumber}
                  className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2">{t.shareNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-sm">{t.yourBalance}</p>
              <p className="text-2xl font-bold text-gray-800">{user?.bids_balance || 0} {t.bids}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setActiveTab('send')}
            className={`flex-1 ${activeTab === 'send' 
              ? 'bg-pink-500 text-gray-800' 
              : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            <Send className="w-4 h-4 mr-2" />
            {t.sendBids}
          </Button>
          <Button
            onClick={() => setActiveTab('history')}
            className={`flex-1 ${activeTab === 'history' 
              ? 'bg-purple-500 text-gray-800' 
              : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            <History className="w-4 h-4 mr-2" />
            {t.history}
          </Button>
        </div>

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-400" />
              {t.giftBids}
            </h2>

            {/* Step 1: Find Recipient */}
            <div className="mb-6">
              <Label className="text-gray-800 mb-2 block">1. {t.findRecipient}</Label>
              <div className="flex gap-2">
                <Input
                  value={recipientNumber}
                  onChange={(e) => {
                    setRecipientNumber(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setRecipientInfo(null);
                  }}
                  placeholder={t.enterCustomerNumber}
                  className="bg-white border-gray-200 text-gray-800 font-mono text-lg tracking-wider"
                  maxLength={8}
                />
                <Button
                  onClick={lookupRecipient}
                  disabled={lookupLoading || recipientNumber.length < 8}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  {lookupLoading ? '...' : <Search className="w-5 h-5" />}
                </Button>
              </div>
              
              {recipientInfo && (
                <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-semibold">{recipientInfo.name}</p>
                    <p className="text-gray-500 text-sm">{t.customerNumberLabel}: {recipientInfo.customer_number}</p>
                  </div>
                  <Check className="w-6 h-6 text-green-400 ml-auto" />
                </div>
              )}
            </div>

            {/* Step 2: Amount */}
            <div className="mb-6">
              <Label className="text-gray-800 mb-2 block">2. {t.numberOfBids}</Label>
              <div className="flex gap-2 flex-wrap mb-3">
                {[5, 10, 25, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    onClick={() => setGiftAmount(amount.toString())}
                    className={`${giftAmount === amount.toString() 
                      ? 'bg-pink-500 text-gray-800' 
                      : 'bg-white text-gray-500 border border-gray-200'}`}
                  >
                    {amount}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder={t.orEnterCustom}
                min="1"
                max={user?.bids_balance || 0}
                className="bg-white border-gray-200 text-gray-800"
              />
              <p className="text-gray-500 text-xs mt-1">
                {t.available}: {user?.bids_balance || 0} {t.bids}
              </p>
            </div>

            {/* Step 3: Message (optional) */}
            <div className="mb-6">
              <Label className="text-gray-800 mb-2 block">3. {t.messageOptional}</Label>
              <Input
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder={t.messagePlaceholder}
                className="bg-white border-gray-200 text-gray-800"
                maxLength={200}
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={sendGift}
              disabled={loading || !recipientInfo || !giftAmount || parseInt(giftAmount) < 1}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-gray-800 font-bold text-lg"
            >
              {loading ? (
                t.sending
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  {giftAmount && recipientInfo 
                    ? `${giftAmount} ${t.bids} → ${recipientInfo.name}`
                    : t.sendGift
                  }
                </>
              )}
            </Button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowRight className="w-5 h-5 text-orange-400" />
                  <span className="text-gray-500 text-sm">{t.sent}</span>
                </div>
                <p className="text-3xl font-bold text-orange-400">{history.total_sent}</p>
                <p className="text-gray-500 text-xs">{t.giftsGiven}</p>
              </div>
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowLeft className="w-5 h-5 text-green-400" />
                  <span className="text-gray-500 text-sm">{t.received}</span>
                </div>
                <p className="text-3xl font-bold text-green-400">{history.total_received}</p>
                <p className="text-gray-500 text-xs">{t.giftsReceived}</p>
              </div>
            </div>

            {/* Sent Gifts */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-orange-400" />
                {t.sentGifts}
              </h3>
              {history.sent.length > 0 ? (
                <div className="space-y-3">
                  {history.sent.map((gift, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <Gift className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-gray-800 font-medium">{t.to}: {gift.recipient_name}</p>
                          <p className="text-gray-500 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(gift.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-bold">-{gift.amount}</p>
                        {gift.message && (
                          <p className="text-gray-500 text-xs truncate max-w-[150px]">{gift.message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">{t.noSentGifts}</p>
              )}
            </div>

            {/* Received Gifts */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowLeft className="w-5 h-5 text-green-400" />
                {t.receivedGifts}
              </h3>
              {history.received.length > 0 ? (
                <div className="space-y-3">
                  {history.received.map((gift, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-gray-800 font-medium">{t.from}: {gift.sender_name}</p>
                          <p className="text-gray-500 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(gift.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold">+{gift.amount}</p>
                        {gift.message && (
                          <p className="text-gray-500 text-xs truncate max-w-[150px]">{gift.message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">{t.noReceivedGifts}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
