const KEYS = ["back","title","subtitle","search","all","play","planned","details","continueGame","community","openPublished","language"];

const ROWS = {
  de: ["Zurück","Dein nächstes Abenteuer.","Entdecke die Spielwelten von BidBlitz.","Spiel suchen","Alle Spiele","Spielvorschau öffnen","In Planung","Details","Weiter","Von Entwicklern","Spiel öffnen","Sprache"],
  en: ["Back","Your next adventure.","Discover the game worlds of BidBlitz.","Search games","All games","Open game preview","Planned","Details","Continue","From developers","Open game","Language"],
  sq: ["Kthehu","Aventura jote e radhës.","Zbulo botët e lojërave BidBlitz.","Kërko lojë","Të gjitha","Hap provën e lojës","Në planifikim","Detaje","Vazhdo","Nga zhvilluesit","Hap lojën","Gjuha"],
  fr: ["Retour","Votre prochaine aventure.","Découvrez les univers de jeu de BidBlitz.","Rechercher des jeux","Tous les jeux","Ouvrir l’aperçu du jeu","Prévu","Détails","Continuer","Des développeurs","Ouvrir le jeu","Langue"],
  es: ["Volver","Tu próxima aventura.","Descubre los mundos de juego de BidBlitz.","Buscar juegos","Todos los juegos","Abrir vista previa","Planificado","Detalles","Continuar","De desarrolladores","Abrir juego","Idioma"],
  pt: ["Voltar","A sua próxima aventura.","Descubra os mundos de jogos da BidBlitz.","Pesquisar jogos","Todos os jogos","Abrir prévia do jogo","Planejado","Detalhes","Continuar","De desenvolvedores","Abrir jogo","Idioma"],
  it: ["Indietro","La tua prossima avventura.","Scopri i mondi di gioco di BidBlitz.","Cerca giochi","Tutti i giochi","Apri anteprima del gioco","In programma","Dettagli","Continua","Dagli sviluppatori","Apri gioco","Lingua"],
  nl: ["Terug","Je volgende avontuur.","Ontdek de spelwerelden van BidBlitz.","Games zoeken","Alle games","Gamevoorbeeld openen","Gepland","Details","Doorgaan","Van ontwikkelaars","Game openen","Taal"],
  pl: ["Wstecz","Twoja następna przygoda.","Odkryj światy gier BidBlitz.","Szukaj gier","Wszystkie gry","Otwórz podgląd gry","Planowane","Szczegóły","Kontynuuj","Od deweloperów","Otwórz grę","Język"],
  cs: ["Zpět","Vaše další dobrodružství.","Objevte herní světy BidBlitz.","Hledat hry","Všechny hry","Otevřít náhled hry","Plánováno","Podrobnosti","Pokračovat","Od vývojářů","Otevřít hru","Jazyk"],
  sk: ["Späť","Vaše ďalšie dobrodružstvo.","Objavte herné svety BidBlitz.","Hľadať hry","Všetky hry","Otvoriť ukážku hry","Plánované","Podrobnosti","Pokračovať","Od vývojárov","Otvoriť hru","Jazyk"],
  hu: ["Vissza","A következő kalandod.","Fedezd fel a BidBlitz játékvilágait.","Játékok keresése","Minden játék","Játékelőnézet megnyitása","Tervezett","Részletek","Folytatás","Fejlesztőktől","Játék megnyitása","Nyelv"],
  ro: ["Înapoi","Următoarea ta aventură.","Descoperă lumile de joc BidBlitz.","Caută jocuri","Toate jocurile","Deschide previzualizarea jocului","Planificat","Detalii","Continuă","De la dezvoltatori","Deschide jocul","Limbă"],
  bg: ["Назад","Следващото ти приключение.","Открий игровите светове на BidBlitz.","Търси игри","Всички игри","Отвори преглед на играта","Планирано","Подробности","Продължи","От разработчици","Отвори играта","Език"],
  el: ["Πίσω","Η επόμενη περιπέτειά σου.","Ανακάλυψε τους κόσμους παιχνιδιών του BidBlitz.","Αναζήτηση παιχνιδιών","Όλα τα παιχνίδια","Άνοιγμα προεπισκόπησης","Προγραμματισμένο","Λεπτομέρειες","Συνέχεια","Από προγραμματιστές","Άνοιγμα παιχνιδιού","Γλώσσα"],
  hr: ["Natrag","Tvoja sljedeća avantura.","Otkrij svjetove igara BidBlitz.","Pretraži igre","Sve igre","Otvori pregled igre","Planirano","Detalji","Nastavi","Od programera","Otvori igru","Jezik"],
  sr: ["Nazad","Tvoja sledeća avantura.","Otkrij svetove igara BidBlitz.","Pretraži igre","Sve igre","Otvori pregled igre","Planirano","Detalji","Nastavi","Od programera","Otvori igru","Jezik"],
  bs: ["Nazad","Tvoja sljedeća avantura.","Otkrij svjetove igara BidBlitz.","Pretraži igre","Sve igre","Otvori pregled igre","Planirano","Detalji","Nastavi","Od programera","Otvori igru","Jezik"],
  sl: ["Nazaj","Tvoja naslednja pustolovščina.","Odkrij igralne svetove BidBlitz.","Išči igre","Vse igre","Odpri predogled igre","Načrtovano","Podrobnosti","Nadaljuj","Od razvijalcev","Odpri igro","Jezik"],
  mk: ["Назад","Твојата следна авантура.","Откриј ги световите на игрите BidBlitz.","Пребарај игри","Сите игри","Отвори преглед на играта","Планирано","Детали","Продолжи","Од програмери","Отвори игра","Јазик"],
  tr: ["Geri","Sıradaki maceran.","BidBlitz oyun dünyalarını keşfet.","Oyun ara","Tüm oyunlar","Oyun önizlemesini aç","Planlandı","Ayrıntılar","Devam et","Geliştiricilerden","Oyunu aç","Dil"],
  ru: ["Назад","Твоё следующее приключение.","Открой игровые миры BidBlitz.","Поиск игр","Все игры","Открыть предпросмотр игры","Запланировано","Подробнее","Продолжить","От разработчиков","Открыть игру","Язык"],
  uk: ["Назад","Твоя наступна пригода.","Відкрий ігрові світи BidBlitz.","Пошук ігор","Усі ігри","Відкрити попередній перегляд","Заплановано","Деталі","Продовжити","Від розробників","Відкрити гру","Мова"],
  sv: ["Tillbaka","Ditt nästa äventyr.","Upptäck BidBlitz spelvärldar.","Sök spel","Alla spel","Öppna spelförhandsvisning","Planerat","Detaljer","Fortsätt","Från utvecklare","Öppna spel","Språk"],
  da: ["Tilbage","Dit næste eventyr.","Oplev BidBlitz' spilverdener.","Søg spil","Alle spil","Åbn spilforhåndsvisning","Planlagt","Detaljer","Fortsæt","Fra udviklere","Åbn spil","Sprog"],
  nb: ["Tilbake","Ditt neste eventyr.","Oppdag BidBlitz sine spillverdener.","Søk spill","Alle spill","Åpne spillforhåndsvisning","Planlagt","Detaljer","Fortsett","Fra utviklere","Åpne spill","Språk"],
  fi: ["Takaisin","Seuraava seikkailusi.","Tutustu BidBlitzin pelimaailmoihin.","Hae pelejä","Kaikki pelit","Avaa pelin esikatselu","Suunnitteilla","Tiedot","Jatka","Kehittäjiltä","Avaa peli","Kieli"],
  et: ["Tagasi","Sinu järgmine seiklus.","Avasta BidBlitzi mängumaailmad.","Otsi mänge","Kõik mängud","Ava mängu eelvaade","Plaanis","Üksikasjad","Jätka","Arendajatelt","Ava mäng","Keel"],
  lt: ["Atgal","Kitas tavo nuotykis.","Atrask BidBlitz žaidimų pasaulius.","Ieškoti žaidimų","Visi žaidimai","Atidaryti žaidimo peržiūrą","Planuojama","Išsamiau","Tęsti","Iš kūrėjų","Atidaryti žaidimą","Kalba"],
  lv: ["Atpakaļ","Tavs nākamais piedzīvojums.","Atklāj BidBlitz spēļu pasaules.","Meklēt spēles","Visas spēles","Atvērt spēles priekšskatījumu","Plānots","Detaļas","Turpināt","No izstrādātājiem","Atvērt spēli","Valoda"],
  is: ["Til baka","Næsta ævintýrið þitt.","Uppgötvaðu leikjaheima BidBlitz.","Leita að leikjum","Allir leikir","Opna forskoðun leiks","Áætlað","Upplýsingar","Halda áfram","Frá hönnuðum","Opna leik","Tungumál"],
  ar: ["رجوع","مغامرتك القادمة.","اكتشف عوالم ألعاب BidBlitz.","ابحث عن ألعاب","كل الألعاب","فتح معاينة اللعبة","قيد التخطيط","التفاصيل","متابعة","من المطورين","فتح اللعبة","اللغة"],
  he: ["חזרה","ההרפתקה הבאה שלך.","גלה את עולמות המשחק של BidBlitz.","חיפוש משחקים","כל המשחקים","פתיחת תצוגה מקדימה","מתוכנן","פרטים","המשך","ממפתחים","פתיחת המשחק","שפה"],
  fa: ["بازگشت","ماجراجویی بعدی شما.","دنیای بازی‌های BidBlitz را کشف کنید.","جستجوی بازی‌ها","همه بازی‌ها","باز کردن پیش‌نمایش بازی","برنامه‌ریزی شده","جزئیات","ادامه","از توسعه‌دهندگان","باز کردن بازی","زبان"],
  ur: ["واپس","آپ کی اگلی مہم۔","BidBlitz کی گیم دنیا دریافت کریں۔","گیمز تلاش کریں","تمام گیمز","گیم پیش نظارہ کھولیں","منصوبہ بند","تفصیلات","جاری رکھیں","ڈیولپرز سے","گیم کھولیں","زبان"],
  hi: ["वापस","आपका अगला रोमांच।","BidBlitz की गेम दुनिया खोजें।","गेम खोजें","सभी गेम","गेम पूर्वावलोकन खोलें","योजनाबद्ध","विवरण","जारी रखें","डेवलपर्स से","गेम खोलें","भाषा"],
  bn: ["ফিরে যান","আপনার পরবর্তী অভিযান।","BidBlitz-এর গেম জগৎ আবিষ্কার করুন।","গেম খুঁজুন","সব গেম","গেম প্রিভিউ খুলুন","পরিকল্পিত","বিস্তারিত","চালিয়ে যান","ডেভেলপারদের থেকে","গেম খুলুন","ভাষা"],
  "zh-Hans": ["返回","你的下一场冒险。","探索 BidBlitz 的游戏世界。","搜索游戏","所有游戏","打开游戏预览","计划中","详情","继续","来自开发者","打开游戏","语言"],
  "zh-Hant": ["返回","你的下一場冒險。","探索 BidBlitz 的遊戲世界。","搜尋遊戲","所有遊戲","開啟遊戲預覽","規劃中","詳情","繼續","來自開發者","開啟遊戲","語言"],
  ja: ["戻る","次の冒険へ。","BidBlitz のゲーム世界を探索しよう。","ゲームを検索","すべてのゲーム","ゲームプレビューを開く","計画中","詳細","続ける","開発者から","ゲームを開く","言語"],
  ko: ["뒤로","다음 모험을 시작하세요.","BidBlitz의 게임 세계를 만나보세요.","게임 검색","모든 게임","게임 미리보기 열기","계획 중","세부정보","계속","개발자 제공","게임 열기","언어"],
  id: ["Kembali","Petualangan berikutnya.","Jelajahi dunia game BidBlitz.","Cari game","Semua game","Buka pratinjau game","Direncanakan","Detail","Lanjutkan","Dari pengembang","Buka game","Bahasa"],
  vi: ["Quay lại","Cuộc phiêu lưu tiếp theo của bạn.","Khám phá thế giới trò chơi BidBlitz.","Tìm trò chơi","Tất cả trò chơi","Mở bản xem trước","Đang lên kế hoạch","Chi tiết","Tiếp tục","Từ nhà phát triển","Mở trò chơi","Ngôn ngữ"],
  th: ["กลับ","การผจญภัยครั้งต่อไปของคุณ","ค้นพบโลกเกมของ BidBlitz","ค้นหาเกม","เกมทั้งหมด","เปิดตัวอย่างเกม","วางแผนไว้","รายละเอียด","เล่นต่อ","จากนักพัฒนา","เปิดเกม","ภาษา"],
  fil: ["Bumalik","Ang susunod mong pakikipagsapalaran.","Tuklasin ang mga mundo ng laro ng BidBlitz.","Maghanap ng laro","Lahat ng laro","Buksan ang preview ng laro","Nakaplano","Detalye","Magpatuloy","Mula sa mga developer","Buksan ang laro","Wika"],
  ta: ["பின்செல்","உங்கள் அடுத்த சாகசம்.","BidBlitz விளையாட்டு உலகங்களை கண்டறியுங்கள்.","விளையாட்டுகளைத் தேடு","அனைத்து விளையாட்டுகள்","விளையாட்டு முன்னோட்டத்தைத் திற","திட்டமிடப்பட்டது","விவரங்கள்","தொடரவும்","உருவாக்குநர்களிடமிருந்து","விளையாட்டைத் திற","மொழி"],
  te: ["వెనక్కి","మీ తదుపరి సాహసం.","BidBlitz గేమ్ ప్రపంచాలను కనుగొనండి.","గేమ్‌లను వెతకండి","అన్ని గేమ్‌లు","గేమ్ ప్రివ్యూ తెరవండి","ప్రణాళికలో","వివరాలు","కొనసాగించండి","డెవలపర్ల నుండి","గేమ్ తెరవండి","భాష"],
  mr: ["मागे","तुमचे पुढचे साहस.","BidBlitz चे गेम विश्व शोधा.","गेम शोधा","सर्व गेम","गेम पूर्वावलोकन उघडा","नियोजित","तपशील","पुढे सुरू ठेवा","डेव्हलपर्सकडून","गेम उघडा","भाषा"],
  ms: ["Kembali","Pengembaraan anda seterusnya.","Terokai dunia permainan BidBlitz.","Cari permainan","Semua permainan","Buka pratonton permainan","Dirancang","Butiran","Teruskan","Daripada pembangun","Buka permainan","Bahasa"],
  sw: ["Rudi","Safari yako inayofuata.","Gundua ulimwengu wa michezo wa BidBlitz.","Tafuta michezo","Michezo yote","Fungua onyesho la mchezo","Imepangwa","Maelezo","Endelea","Kutoka kwa watengenezaji","Fungua mchezo","Lugha"],
  af: ["Terug","Jou volgende avontuur.","Ontdek BidBlitz se speletjiewêrelde.","Soek speletjies","Alle speletjies","Maak spelvoorskou oop","Beplan","Besonderhede","Gaan voort","Van ontwikkelaars","Maak spel oop","Taal"]
};

export const GAMES_CORE_TRANSLATION_CODES = Object.freeze(Object.keys(ROWS));

export function getGamesCoreCopy(code) {
  const row = ROWS[code] || ROWS.en;
  return Object.fromEntries(KEYS.map((key, index) => [key, row[index]]));
}

export function hasGamesCoreTranslation(code) {
  return Object.hasOwn(ROWS, code);
}
