import { getJakartaToday } from "./date";

/**
 * Daily Love Task — shared between the API (validation, rotation) and the
 * client card. Keeping the bank and every pure rule in one dependency-free
 * module means a task stored by one device is always a task the server and
 * every other device can render.
 */
export const DAILY_LOVE_TASKS = [
  "Kirim pesan selamat pagi yang manis",
  "Bilang 'Aku bangga padamu' hari ini",
  "Peluk pasanganmu 10 detik tanpa alasan",
  "Kirim foto random lucu hari ini",
  "Tulis 1 hal yang kamu syukuri dari pasangan",
  "Kasih pujian tulus ke pasangan",
  "Ajak ngobrol 15 menit tanpa HP",
  "Buatkan minuman atau cemilan kecil",
  "Kirim voice note random",
  "Ingatkan pasangan untuk minum air putih",
  "Sebut 1 kenangan indah bareng dia",
  "Tanya 'Hari ini gimana?' dan dengar sungguh-sungguh",
  "Beri surprise kecil (stiker, GIF, meme)",
  "Bilang 'Makasih ya' atas hal kecil",
  "Rencanakan kencan dadakan",
  "Kirim lagu yang ingetin kamu sama dia",
  "Tulis pesan di notes atau kertas fisik",
  "Ingetin pasangan buat istirahat",
  "Sebut 1 hal yang kamu suka dari fisik dia",
  "Bikin playlist lagu untuk hari ini",
  "Tanya mimpi atau cita-cita pasangan",
  "Kirim doa atau harapan baik untuk dia",
  "Beri kejutan virtual (link lucu, meme)",
  "Luangkan waktu quality time meski sebentar",
  "Tulis回忆 singkat tentang kencan pertama",
  "Bilang 'I love you' dengan cara beda",
  "Tanya kabar keluarganya",
  "Share artikel/video yang bikin inget dia",
  "Ajak ngobrol tentang masa depan",
  "Bikin kartu digital kecil-kecilan",
  "Send a cute selfie with a funny caption",
  "Tulis 3 alasan kenapa kamu sayang dia",
  "Bikin sarapan atau camilan spesial",
  "Kirim pesan tengah malam yang manis",
  "Ajak dance bareng di rumah (5 menit)",
  "Tanya warna favorit dia hari ini",
  "Bilang 'Kamu cantik/ganteng banget' hari ini",
  "Kirim playlist lagu romantis",
  "Bikin surprise 'Good Morning' text",
  "Ingetin dia buat makan siang",
  "Send a random 'I was just thinking about you' text",
  "Bikin foto collage kenangan kalian",
  "Tulis surat cinta 1 paragraf",
  "Ajak nonton movie bareng (online/offline)",
  "Bilang 'Maaf ya' untuk hal kecil (walaupun nggak salah)",
  "Kirim meme yang relate sama relationship kalian",
  "Tanya 'Apa yang bikin kamu bahagia hari ini?'",
  "Bikin challenge 'Siapa yang bisa bikin siapa ketawa duluan'",
  "Kirim voice note nyanyiin lagu buat dia",
  "Sebut 1 kenangan lucu yang pernah kalian alami",
  "Tanya tentang mimpi dia semalam",
  "Bikin kuis kecil 'Seberapa kenal kamu sama aku'",
  "Kirim stiker lucu di chat",
  "Bilang 'I choose you' hari ini",
  "Ajak jalan-jalan virtual (Google Maps bareng)",
  "Tulis pesan rahasia di tangan atau kertas",
  "Kirim foto kenangan lama dan ceritain momennya",
  "Bikin daftar 5 wishlist yang ingin dicapai bareng",
  "Tanya 'Apa hal terbaik yang terjadi hari ini?'",
  "Bikin challenge foto 'Wajah lucu' bareng",
  "Kirim lagu yang lyric-nya relate",
  "Sebut sesuatu yang kamu pelajari dari pasangan",
  "Bikin video pendek ucapan sayang",
  "Tanya 'Kalau jadi superhero, kamu bakal jadi apa?'",
  "Kirim foto benda yang bikin inget dia",
  "Ajak main game bareng (mobile/online)",
  "Bilang terima kasih untuk hal spesifik yang dia lakukan",
  "Bikin bucket list 10 hal yang ingin dilakukan bareng",
  "Kirim tebak-tebakan lucu",
  "Tanya 'Apa bahasa cinta kamu hari ini?'",
  "Bikin wallpaper HP dengan foto kalian",
  "Send a 'Just because' gift (e-voucher, pulsa, dll)",
  "Tulis puisi pendek 4 baris buat dia",
  "Ajak stargazing virtual (lihat bintang bareng via call)",
  "Bilang 'Kamu bikin hariku lebih baik'",
  "Kirim screenshot lagu yang sedang kamu dengar",
  "Tanya 'Apa yang kamu suka dari hubungan kita?'",
  "Bikin kode rahasia cuma kalian berdua yang tahu",
  "Kirim paket surprise lewat ojek online",
  "Bikin playlists 3 lagu yang mewakili perasaanmu",
  "Tulis diary entry pendek tentang hari ini",
  "Ajak cooking challenge bareng (masak menu yang sama)",
  "Bilang 'Aku percaya sama kamu' hari ini",
  "Kirim foto langit/sunset dengan pesan manis",
  "Tanya 'Apa impian terbesarmu?' dan diskusikan",
  "Bikin origami atau kerajinan tangan kecil",
  "Kirim voice note random ngomong 'I miss you'",
  "Ajak olahraga bareng (workout challenge)",
  "Bilang 'You're my favorite person'",
  "Bikin video compilasi momen-momen lucu kalian",
  "Tanya 'Apa hal paling random yang kamu pikirkan hari ini?'",
  "Kirim Dare 'Truth or Dare' versi kalian",
  "Bikin scrapbook digital kecil-kecilan",
  "Sebut 1 kebiasaan pasangan yang kamu suka",
  "Ajak belajar hal baru bareng (skill/online course)",
  "Kirim pesan puitis ala-ala pujangga",
  "Bikin foto mirror selfie bareng (via kamera terpisah)",
  "Tanya 'Di mana kamu ingin pergi liburan?'",
  "Bilang 'Kamu segalanya buat aku'",
  "Kirim komik strip pendek buatan sendiri",
  "Ajak binge-watch series favorit kalian",
  "Bikin teka-teki silang mini tentang hubungan kalian",
  "Send a 'Good night' text with a sweet dream wish",
  "Tulis 1 hal yang kamu kagumi dari pasangan",
  "Ajak piknik virtual (makan bareng via video call)",
  "Kirim foto outfit hari ini dan minta pendapat",
  "Bilang 'I'm lucky to have you' hari ini",
  "Bikin album kenangan digital (Google Photos)",
  "Tanya 'Apa makanan favoritmu hari ini?'",
  "Kirim challenge 'Siapa yang paling inget detail'",
  "Bikin notes di HP dengan pesan rahasia",
  "Ajak ngomong pake bahasa alien bareng",
  "Bilang 'Kamu rumahku'",
  "Kirim foto hewan lucu yang ingetin kamu sama dia",
  "Tanya 'Apa yang bisa aku bikin buat kamu hari ini?'",
  "Bikin playlist 'Lagu cinta kita'",
  "Ajak main tebak kata lewat chat",
  "Send a random 'Thank you for being you' text",
  "Bikin kartu ucapan digital (Canva)",
  "Tulis 5 hal yang kamu suka tentang hubungan kalian",
  "Ajak date night theme (misal: 'Malam Italia')",
  "Bilang 'You make everything better'",
  "Kirim foto buku halaman favorit dan bacain quote",
  "Tanya 'Kalau bisa repeat hari ini, apa yang mau diulang?'",
  "Bikin challenge saling melukis/coret wajah di foto",
  "Send a mysterious love riddle",
  "Ajak karaoke bareng lewat app",
  "Bilang 'Aku milih kamu, hari ini dan selamanya'",
  "Kirim screenshot chat lama yang lucu",
  "Tanya 'Apa hal paling konyol yang kamu lakukan minggu ini?'",
  "Bikin kapsul waktu digital (tulis pesan buat 1 tahun lagi)",
  "Ajak photo challenge 'A-Z' (setiap huruf mewakili pose)",
  "Bilang 'Kamu bikin aku jadi orang yang lebih baik'",
  "Kirim voice note suara ketawa kamu",
  "Tanya 'Apa bahasa cinta yang kamu butuhin hari ini?'",
  "Bikin daftar 10 alasan kenapa kamu cinta dia",
  "Ajak main 20 questions lewat chat",
  "Send a 'You're on my mind' text randomly",
  "Kirim foto tangan kamu dengan pesan manis",
  "Bilang 'Aku nggak pernah bosan sama kamu'",
  "Tanya 'Apa hal pertama yang kamu lihat dari aku?'",
  "Bikin origami hati dan kirim fotonya",
  "Ajak diskusi 'Apa arti cinta menurut kita?'",
  "Kirim puzzle teka-teki hubungan kalian",
  "Bilang 'I'd choose you in every lifetime'",
  "Tulis quotes favorit kalian dan kasih maknanya",
  "Ajak pillow fort challenge (bikin benteng bantal)",
  "Send a 'Happy halfway to the weekend' text",
  "Bikin video lipsync lagu cinta buat dia",
  "Tanya 'Apa yang kamu tunggu-tunggu dari aku?'",
  "Bilang 'Kamu buat dunia lebih berwarna'",
  "Kirim foto tanaman/bunga yang lagi mekar",
  "Ajak guess the song challenge",
  "Bikin kalender countdown untuk momen spesial",
  "Send a random 'Sending you a virtual hug'",
  "Tulis pesan di debu/kaca mobil",
  "Ajak deep talk tentang kehidupan dan tujuan",
  "Bilang 'Aku bersyukur punya kamu'",
  "Kirim foto langit malam dengan pesan romantis",
  "Tanya 'Apa yang kamu ingat dari pertama kita ketemu?'",
  "Bikin challenge 'Sehari tanpa ngomong 'I love you' (tapi kasih kode)",
  "Ajak masak bareng via video call",
  "Send a 'Just thinking of you' meme",
  "Bilang 'Kamu adalah petualangan terindah'",
  "Kirim foto makanan yang lagi kamu makan",
  "Tanya 'Apa superpower yang kamu pengen punya?'",
  "Bikin dance challenge TikTok bareng",
  "Ajak main catur atau board game online",
  "Bilang 'My heart belongs to you' hari ini",
  "Kirim pesan acak pake bahasa daerah",
  "Tanya 'Apa yang bikin kamu merasa dicintai?'",
  "Bikin playlists 5 lagu yang bikin kamu inget dia",
  "Ajak ngitung bintang virtual bareng",
  "Send a 'You're my sunshine' message",
  "Bikin komik strip 4 panel tentang hari kalian",
  "Tanya 'Kalau kamu jadi benda, jadi apa?'",
  "Bilang 'I love you more than...' (isi sendiri)",
  "Kirim foto tempat yang pengen kamu kunjungi bareng",
  "Ajak mimic challenge (bikin ekspresi yang sama)",
  "Bikin video tutorial sesuatu yang kamu bisa",
  "Tanya 'Apa hal paling berani yang pernah kamu lakukan?'",
  "Bilang 'Kamu adalah hadiah terindah'",
  "Kirim challenge estafet pesan berantai",
  "Ajak lomba estafet cerita (tiap orang 3 kata)",
  "Bikin mading digital tentang hubungan kalian",
  "Send a 'Can't stop thinking about you' text",
  "Tulis ulang tahun hubungan kalian di something",
  "Ajak marathon film horor/komedi bareng",
  "Bilang 'You're my happy pill'",
  "Kirim foto selfie dengan latar favorit",
  "Tanya 'Apa yang kamu syukuri hari ini dari hubungan kita?'",
  "Bikin ramalan zodiak versi kalian sendiri",
  "Ajak main 'Would You Rather' versi relationship",
  "Send a 'I appreciate you for...' specific message",
  "Bikin foto wajah lucu dengan filter aneh",
  "Tanya 'Kalau kita bisa teleport, mau ke mana?'",
  "Bilang 'Bersamamu aku merasa utuh'",
  "Kirim pesan ucapan random 'Semangat ya!'",
  "Ajak membuat kode morse versi kalian",
  "Bikin playlist 'Lagu pengantar tidur'",
  "Send a voice note singing a lullaby",
  "Tanya 'Apa konser/live music yang ingin kamu tonton bareng?'",
  "Bilang 'You're the best thing that happened to me'",
  "Kirim foto buku catatan coret-coret kalian",
  "Ajak challenge 'Bikin cerita dari 1 foto'",
  "Bikin wallpaper chat berdua yang baru",
  "Send a 'Have I told you lately that I love you?' text",
  "Tulis janji cinta di social media (bisa story)",
  "Ajak belajar bahasa isyarat bareng",
  "Bilang 'Aku nggak pernah merasa secukup ini sebelumnya'",
  "Kirim foto sesuatu yang berbau nostalgia",
  "Tanya 'Apa yang ingin kamu ubah dari dirimu?'",
  "Bikin kolase foto 'Perjalanan Cinta Kita'",
  "Ajak pretend date di rumah (dress up, candle light)",
  "Send a 'You matter to me' message",
  "Bikin quote challenge: tebak siapa yang ngomong",
  "Tanya 'Apa definisi cinta versi kamu?'",
  "Bilang 'Kamu adalah rumah yang selalu aku tuju'",
  "Kirim voice note ucapan selamat tidur",
  "Ajak make something together (DIY challenge)",
  "Bikin timeline hubungan kalian dari awal sampai sekarang",
  "Send a 'I'm grateful for you' text without context",
  "Tanya 'Apa hal paling random yang kamu suka dari aku?'",
  "Bilang 'You're my favorite notification'",
  "Kirim foto bayangan kalian berdua",
  "Ajak challenge 'Siapa yang bisa diem paling lama' terus ketawa",
  "Bikin playlist 'Lagu untuk masa depan kita'",
  "Send a 'I hope your day is as beautiful as you are' text",
  "Tanya 'Di mana kamu lihat kita 5 tahun lagi?'",
  "Bilang 'Denganmu, aku percaya pada cinta'",
  // Second wave — appended so the bank reaches a full year (365) without
  // renaming a single existing task (stored rows are validated against this
  // list, so existing strings must stay byte-identical).
  "Tulis 3 hal yang bikin kamu jatuh cinta lagi hari ini",
  "Kirim pesan suara bilang 'Semangat, aku di sini'",
  "Ajak pasangan bikin resolusi kecil bareng",
  "Sebut satu hal yang bikin kamu bangga sama dia",
  "Kirim foto senyum kamu tanpa filter",
  "Bilang 'Hari ini aku mikirin kamu terus'",
  "Tanya 'Kalau kita punya satu hari bebas, mau ngapain?'",
  "Bikin daftar lagu untuk perjalanan pulang",
  "Kirim pesan 'Aku suka cara kamu ketawa'",
  "Ajak pasangan bikin vision board sederhana",
  "Tulis satu kalimat doa untuk hubungan kalian",
  "Kirim emoji yang paling menggambarkan perasaanmu hari ini",
  "Tanya 'Apa hal kecil yang bikin kamu senyum hari ini?'",
  "Bilang 'Terima kasih sudah sabar sama aku'",
  "Bikin tantangan 5 menit saling memuji tanpa henti",
  "Kirim foto jam dinding terdekat, tanya 'jam berapa di tempatmu?'",
  "Ajak pasangan sarapan bareng lewat video call",
  "Tulis nama dia di catatan HP dengan pesan manis",
  "Bilang 'Aku kangen suara kamu'",
  "Kirim voice note cerita satu hal lucu hari ini",
  "Tanya 'Apa lagu yang lagi kamu dengar sekarang?'",
  "Bikin janji kecil untuk akhir pekan ini",
  "Sebut satu hal yang ingin kamu lakukan bareng bulan ini",
  "Kirim foto tempat makan favorit kalian",
  "Bilang 'Kamu bikin aku semangat hari ini'",
  "Ajak pasangan jalan kaki bareng sambil telefon",
  "Tulis tiga kata yang menggambarkan dia",
  "Kirim stiker yang paling mirip ekspresi dia",
  "Tanya 'Apa hal yang paling kamu tunggu minggu ini?'",
  "Bilang 'Aku bangga sama usaha kamu hari ini'",
  "Bikin tebak-tebakan receh, lihat siapa yang ketawa dulu",
  "Kirim foto makanan penutup favorit kalian",
  "Tanya 'Kalau bisa telpon sekarang, mau ngobrol apa?'",
  "Sebut satu kebiasaan kecil dia yang bikin kamu tenang",
  "Bilang 'Aku selalu ada kalau kamu butuh'",
  "Kirim screenshot percakapan lucu kalian dulu",
  "Ajak pasangan bikin daftar film yang mau ditonton bareng",
  "Tulis pesan singkat pakai bahasa isyarat sendiri",
  "Tanya 'Apa yang bikin kamu merasa aman sama aku?'",
  "Bilang 'Aku suka banget cara kamu peduli'",
  "Kirim foto bunga atau tanaman di sekitar kamu",
  "Ajak pasangan bikin playlist untuk kerja atau belajar",
  "Tulis satu kalimat pujian yang belum pernah kamu bilang",
  "Tanya 'Apa mimpi kecil yang ingin kamu wujudkan tahun ini?'",
  "Bilang 'Aku bersyukur kamu ada di hidupku'",
  "Kirim voice note ketawa kamu tanpa alasan",
  "Ajak pasangan bikin tantangan foto 1 menit",
  "Sebut satu hal yang kamu rindukan dari dia",
  "Kirim pesan 'Kalau kamu lelah, istirahat ya'",
  "Tanya 'Apa makanan yang bikin kamu inget rumah?'",
  "Bilang 'Aku suka cara kamu bercerita'",
  "Bikin pantun lucu 2 baris buat dia",
  "Kirim foto bayanganmu dengan pesan singkat",
  "Ajak pasangan bikin daftar 3 hal yang mau dicoba bareng",
  "Tulis pesan pengingat bahwa kamu sayang dia",
  "Tanya 'Apa yang kamu butuh hari ini?'",
  "Bilang 'Aku nggak sabar ketemu kamu lagi'",
  "Kirim rekaman suara hujan atau suasana di sekitar kamu",
  "Ajak pasangan bikin komitmen kecil minggu ini",
  "Sebut satu alasan kamu memilih dia setiap hari",
  "Kirim foto langit pagi ini",
  "Tanya 'Apa hal yang paling kamu syukuri minggu ini?'",
  "Bilang 'Aku suka banget ngobrol sama kamu'",
  "Bikin daftar 5 hal yang mau kamu lakukan untuk dia",
  "Kirim pesan 'Jangan lupa makan ya'",
  "Ajak pasangan bikin teka-teki angka lucu",
  "Tulis satu kenangan yang bikin kamu tersenyum",
  "Tanya 'Apa yang bikin kamu bangga sama diri sendiri hari ini?'",
  "Bilang 'Kamu hebat, aku tahu itu'",
  "Kirim foto meja kerja atau tempat belajar kamu",
  "Ajak pasangan bikin janji untuk matikan HP 10 menit",
  "Sebut satu hal yang mau kamu pelajari bareng dia",
  "Kirim pesan 'Aku dengar kok, cerita lagi ya'",
  "Tanya 'Apa hal yang paling kamu ingat dari minggu ini?'",
  "Bilang 'Aku suka banget cara kamu mikir'",
  "Bikin cerita pendek 3 kalimat tentang kalian",
  "Kirim voice note bilang 'Selamat pagi, sayang'",
  "Ajak pasangan bikin daftar tempat yang mau dikunjungi",
  "Tulis satu hal yang bikin kamu kagum sama dia minggu ini",
  "Tanya 'Apa hal yang bikin kamu deg-degan dulu?'",
  "Bilang 'Aku masih ingat pertama kali kita ngobrol'",
  "Kirim foto kopi atau minuman favoritmu",
  "Ajak pasangan bikin tantangan saling kirim meme",
  "Sebut satu hal yang kamu pelajari dari hubungan ini",
  "Kirim pesan 'Kamu nggak sendirian, aku ada'",
  "Tanya 'Kalau punya waktu luang besok, mau ke mana?'",
  "Bilang 'Aku suka banget cara kamu memperhatikan hal kecil'",
  "Bikin daftar 3 hal yang mau kamu ucapkan terima kasih",
  "Kirim foto minuman sehat, ingetin dia minum",
  "Ajak pasangan bikin rencana makan malam virtual",
  "Tulis satu kalimat yang bikin dia tersenyum",
  "Tanya 'Apa hal yang kamu takutkan tapi ingin dicoba?'",
  "Bilang 'Aku bangga bisa sama kamu'",
  "Kirim voice note nyanyi satu baris lagu cinta",
  "Ajak pasangan bikin daftar 3 hal seru minggu ini",
  "Sebut satu hal yang kamu suka dari senyumnya",
  "Kirim pesan 'Aku mikirin masa depan kita'",
  "Tanya 'Apa hal yang bikin kamu tenang?'",
  "Bilang 'Terima kasih sudah jadi kamu'",
  "Bikin 3 pertanyaan tentang kenangan kalian, lihat dia ingat atau tidak",
  "Kirim foto kenangan yang belum pernah kamu kirim",
  "Ajak pasangan bikin jadwal telpon rutin",
  "Tulis satu hal yang mau kamu perbaiki bareng dia",
  "Tanya 'Apa yang bikin kamu merasa dihargai?'",
  "Bilang 'Aku suka banget cara kamu jaga hubungan ini'",
  "Kirim pesan 'Aku bangga sama kita'",
  "Ajak pasangan bikin tantangan 3 hari saling kirim pesan pagi",
  "Sebut satu hal yang bikin kamu nyaman sama dia",
  "Kirim foto hal yang lagi kamu kerjakan",
  "Tanya 'Apa yang kamu pelajari hari ini?'",
  "Bilang 'Kamu bikin aku merasa cukup'",
  "Bikin daftar 5 lagu untuk malam minggu",
  "Kirim voice note bilang 'Aku kangen kamu'",
  "Ajak pasangan bikin daftar hadiah kecil yang bermakna",
  "Tulis satu hal yang kamu suka dari cara dia memperlakukan orang lain",
  "Tanya 'Apa hal yang bikin kamu bangga sama kita?'",
  "Bilang 'Aku nggak mau kehilangan kamu'",
  "Kirim foto tangan kalian kalau lagi bareng",
  "Ajak pasangan bikin rencana liburan singkat",
  "Sebut satu hal yang kamu rindukan dari awal hubungan",
  "Kirim pesan 'Semoga harimu menyenangkan'",
  "Tanya 'Apa hal yang bikin kamu semangat pagi ini?'",
  "Bilang 'Aku suka banget cara kamu minta maaf'",
  "Bikin cerita lucu tentang hari pertama kalian kenal",
  "Kirim foto tempat duduk favoritmu",
  "Ajak pasangan bikin daftar cita-cita 5 tahun ke depan",
  "Tulis satu kalimat yang mau kamu ucapkan setiap hari",
  "Tanya 'Kapan terakhir kamu merasa sangat dicintai?'",
  "Bilang 'Aku memilih kamu, lagi dan lagi'",
  "Kirim voice note 'Aku sayang kamu, jangan lupa istirahat'",
  "Ajak pasangan bikin tantangan masak menu sederhana",
  "Sebut satu hal yang kamu suka dari suaranya",
  "Kirim pesan 'Aku di sini kalau kamu mau cerita'",
  "Tanya 'Satu hal yang bikin kamu ketawa hari ini apa?'",
  "Bilang 'Terima kasih sudah ada buat aku'",
] as const;

export type DailyLoveTask = (typeof DAILY_LOVE_TASKS)[number];

export type DailyLoveTaskHistoryEntry = {
  task: string;
  /** Jakarta calendar day (`YYYY-MM-DD`). Empty only for pre-date legacy guest data. */
  date: string;
};

export type DailyLoveTaskState = {
  date: string;
  task: string;
  done: boolean;
  streak: number;
  history: DailyLoveTaskHistoryEntry[];
};

const ROTATION_START_UTC = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayKeyToUtcMs(dayKey: string): number | null {
  const match = DAY_KEY_RE.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

function utcMsToDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a real calendar day key (`YYYY-MM-DD`), rejecting 2026-02-30. */
export function isLoveTaskDayKey(value: string): boolean {
  return dayKeyToUtcMs(value) !== null;
}

/** Previous calendar day, month/year/leap-year safe. Falls back to the input. */
export function previousDayKey(dayKey: string): string {
  const ms = dayKeyToUtcMs(dayKey);
  if (ms === null) return dayKey;
  return utcMsToDayKey(ms - DAY_MS);
}

/** True if `value` is one of the canonical tasks (typed against the bank). */
export function isDailyLoveTask(value: string): value is DailyLoveTask {
  return (DAILY_LOVE_TASKS as readonly string[]).includes(value);
}

/**
 * Deterministic daily rotation, identical for every caller for the same Jakarta
 * day. Same arithmetic as the original client-only implementation, so the task
 * a user sees today does not change when their state moves to the server.
 */
export function getDailyLoveTaskForDate(dayKey: string = getJakartaToday()): DailyLoveTask {
  const ms = dayKeyToUtcMs(dayKey);
  if (ms === null) return DAILY_LOVE_TASKS[0];
  const diff = Math.round((ms - ROTATION_START_UTC) / DAY_MS);
  const index = ((diff % DAILY_LOVE_TASKS.length) + DAILY_LOVE_TASKS.length) % DAILY_LOVE_TASKS.length;
  return DAILY_LOVE_TASKS[index];
}

/**
 * Consecutive completed days ending today — or yesterday when today has not
 * been completed yet, so the streak does not visually reset before midnight.
 * Derived state only: there is no counter to drift out of sync.
 */
export function getLoveTaskStreak(
  doneDayKeys: Iterable<string>,
  todayKey: string = getJakartaToday(),
): number {
  const done = new Set(doneDayKeys);
  let cursor = done.has(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

/**
 * Newest-first, one row per task (matching the old history semantics: a task is
 * listed once at its latest completion). The default limit is the whole bank so
 * the picker can see every task the user has already completed — that is what
 * makes "no repeats until the bank is exhausted" true, not approximate.
 */
export function getLoveTaskHistory(
  rows: ReadonlyArray<DailyLoveTaskHistoryEntry>,
  limit: number = DAILY_LOVE_TASKS.length,
): DailyLoveTaskHistoryEntry[] {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const history: DailyLoveTaskHistoryEntry[] = [];
  for (const row of sorted) {
    if (seen.has(row.task)) continue;
    seen.add(row.task);
    history.push({ task: row.task, date: row.date });
    if (history.length >= limit) break;
  }
  return history;
}

/**
 * Pick a task the user has not seen yet, falling back to any task but the
 * current one when the bank is exhausted. Pure + injectable RNG for tests.
 */
export function pickNextLoveTask(
  currentTask: string,
  history: ReadonlyArray<DailyLoveTaskHistoryEntry>,
  random: () => number = Math.random,
): DailyLoveTask {
  const exclude = new Set<string>([currentTask, ...history.map((entry) => entry.task)]);
  let pool = DAILY_LOVE_TASKS.filter((task) => !exclude.has(task));
  if (pool.length === 0) {
    pool = DAILY_LOVE_TASKS.filter((task) => task !== currentTask);
  }
  if (pool.length === 0) return DAILY_LOVE_TASKS[0];
  const index = Math.min(Math.max(Math.floor(random() * pool.length), 0), pool.length - 1);
  return pool[index];
}

/** `Sab, 14 Nov` — Jakarta calendar label for the card header. */
export function formatLoveTaskDayLabel(dayKey: string): string {
  const ms = dayKeyToUtcMs(dayKey);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** `14 Nov`, or `14 Nov 2025` when the entry is not from the current year. */
export function formatLoveTaskHistoryDate(
  dayKey: string,
  todayKey: string = getJakartaToday(),
): string {
  const ms = dayKeyToUtcMs(dayKey);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(dayKey.slice(0, 4) === todayKey.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
