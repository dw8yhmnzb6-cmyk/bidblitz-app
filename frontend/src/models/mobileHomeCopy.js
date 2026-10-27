// Copy for the compact home and its information page; regional variants share a language.
const labels = ["intro", "services", "about", "investors", "rewards", "activity", "all", "empty", "myQr"];
const translations = {
  de: ["Geld senden, empfangen und im Alltag bezahlen.", "Deine Dienste", "Über BidBlitz", "Investoren", "Prämien", "Letzte Aktivitäten", "Alle anzeigen", "Noch keine Aktivitäten", "Mein QR"],
  en: ["Send, receive and pay every day.", "Your services", "About BidBlitz", "Investors", "Rewards", "Recent activity", "View all", "No activity yet", "My QR"],
  sq: ["Dërgo, merr dhe paguaj çdo ditë.", "Shërbimet e tua", "Rreth BidBlitz", "Investitorët", "Shpërblime", "Aktiviteti i fundit", "Shiko të gjitha", "Ende nuk ka aktivitet", "QR im"],
  tr: ["Para gönder, al ve günlük ödemelerini yap.", "Hizmetlerin", "BidBlitz hakkında", "Yatırımcılar", "Ödüller", "Son işlemler", "Tümünü gör", "Henüz işlem yok", "QR kodum"],
  fr: ["Envoyez, recevez et payez au quotidien.", "Vos services", "À propos de BidBlitz", "Investisseurs", "Récompenses", "Activité récente", "Tout afficher", "Aucune activité", "Mon QR"],
  es: ["Envía, recibe y paga cada día.", "Tus servicios", "Acerca de BidBlitz", "Inversores", "Recompensas", "Actividad reciente", "Ver todo", "Sin actividad todavía", "Mi QR"],
  it: ["Invia, ricevi e paga ogni giorno.", "I tuoi servizi", "Informazioni su BidBlitz", "Investitori", "Premi", "Attività recenti", "Mostra tutto", "Nessuna attività", "Il mio QR"],
  pt: ["Envia, recebe e paga no dia a dia.", "Os teus serviços", "Sobre a BidBlitz", "Investidores", "Recompensas", "Atividade recente", "Ver tudo", "Ainda sem atividade", "O meu QR"],
  nl: ["Verstuur, ontvang en betaal elke dag.", "Jouw diensten", "Over BidBlitz", "Investeerders", "Beloningen", "Recente activiteit", "Alles bekijken", "Nog geen activiteit", "Mijn QR"],
  pl: ["Wysyłaj, odbieraj i płać na co dzień.", "Twoje usługi", "O BidBlitz", "Inwestorzy", "Nagrody", "Ostatnia aktywność", "Zobacz wszystko", "Brak aktywności", "Mój QR"],
  ru: ["Отправляйте, получайте и платите каждый день.", "Ваши услуги", "О BidBlitz", "Инвесторам", "Награды", "Последние операции", "Показать всё", "Операций пока нет", "Мой QR"],
  ar: ["أرسل الأموال واستقبلها وادفع كل يوم.", "خدماتك", "عن BidBlitz", "المستثمرون", "المكافآت", "آخر الأنشطة", "عرض الكل", "لا توجد أنشطة بعد", "رمز QR الخاص بي"],
};
export function getMobileHomeCopy(lang = "en") {
  const values = translations[String(lang).split("-")[0]] || translations.en;
  return Object.fromEntries(labels.map((key, index) => [key, values[index]]));
}
