import { getJakartaParts } from "./date";

export const QUOTES = [
  "Cinta tidak selalu tentang bertambahnya usia, tapi tentang bertambahnya cerita.",
  "Kamu adalah alasan aku tersenyum setiap hari.",
  "Bersamamu, setiap hari terasa seperti hari Valentine.",
  "Aku mencintaimu lebih dari kata-kata yang bisa kuungkapkan.",
  "Kamu adalah rumahku.",
  "Dalam setiap cerita, ada kamu. Dalam setiap mimpi, ada kita.",
  "Dari semua orang di dunia, aku memilih kamu. Setiap hari.",
  "Cinta sejati tidak terburu-buru, karena ia tahu akan bertahan selamanya.",
  "Aku tidak butuh bintang di langit, karena aku sudah punyamu di sini.",
  "Setiap detik bersamamu adalah kenangan yang ingin kuulang.",
  "Kamu dan aku, seperti kopi dan hujan — kombinasi yang sempurna.",
  "Aku jatuh cinta padamu bukan karena kesempurnaanmu, tapi karena ketidaksempurnaanmu yang membuatku tersenyum.",
  "Cinta kita seperti matahari terbit — indah, hangat, dan selalu dinanti.",
  "Bersamamu, aku belajar bahwa cinta bukan tentang saling memiliki, tapi saling melengkapi.",
  "Kamu adalah chapter terbaik dalam hidupku.",
  "Seandainya waktu bisa kuputar ulang, aku akan jatuh cinta padamu berulang kali.",
  "Aku mencintaimu hari ini lebih dari kemarin, tapi kurang dari besok.",
  "Kamu adalah alasan aku percaya pada cinta sejati.",
  "Dalam lautan orang, aku memilihmu. Dan aku akan terus memilihmu.",
  "Cinta kita sederhana, tapi berharga.",
  "You are my today and all of my tomorrows.",
  "I love you more than the entire world.",
  "Every love story is beautiful, but ours is my favorite.",
  "Home is wherever I'm with you.",
  "You're the peanut butter to my jelly.",
  "I didn't believe in love at first sight until I met you.",
  "You make my heart smile.",
  "I'd pick you every time. Every lifetime.",
  "You're the best thing that's ever been mine.",
  "I love you to the moon and back.",
  "Aku suka caramu menceritakan hari biasa jadi terasa istimewa.",
  "Kalau rindu punya bentuk, mungkin ia terlihat seperti namamu.",
  "Terima kasih sudah jadi tempat pulang yang tidak pernah membosankan.",
  "Hal favoritku bukan tempatnya, tapi kamu yang ada di sana.",
  "Aku bisa menghabiskan seharian hanya mendengarkan ceritamu yang itu-itu saja.",
  "Kamu bikin hal-hal kecil terasa seperti alasan untuk bersyukur.",
  "Kalau boleh minta satu hal, aku minta lebih banyak waktu bersamamu.",
  "Senyummu itu masalah, karena aku jadi lupa apa yang tadi mau kukatakan.",
  "Aku tidak sedang jatuh cinta lagi — aku masih jatuh cinta, di tempat yang sama.",
  "Setiap rencana yang kutulis selalu punya satu baris kosong untukmu.",
  "Kamu bukan pelarian, kamu tujuan.",
  "Kalau dunia sedang berisik, suaramu jadi tempat paling tenang.",
  "Aku ingin tua bersamamu dan tetap berebut selimut.",
  "Tidak semua hal perlu dijelaskan, seperti kenapa aku selalu memilihmu.",
  "Kopi pagi lebih enak kalau ada pesan darimu lebih dulu.",
  "Aku baru tahu arti nyaman setelah duduk diam bersamamu.",
  "Mau hujan atau panas, asal pulangnya ke kamu.",
  "Kamu selalu jadi bagian paling menyenangkan dari hariku.",
  "Aku masih menyimpan semua hal kecil yang kamu bilang, tanpa kamu tahu.",
  "Bersamamu, bahkan antre panjang terasa seperti kencan.",
  "Setiap foto kita punya cerita yang sama: aku bahagia.",
  "Aku ingin melihat versi terbaikmu, dan tetap memeluk versi lelahmu.",
  "Kalau aku bisa mengulang satu hari, aku pilih hari pertama kita bertemu.",
  "Kamu itu seperti lagu favorit yang tidak pernah bosan kuputar ulang.",
  "Tidak perlu hari spesial — kamu sudah cukup jadi alasan hari ini terasa spesial.",
  "I still get excited when your name shows up on my screen.",
  "You're my favorite part of every ordinary day.",
  "I like who I am when I'm with you.",
  "Somehow, silence with you feels like a whole conversation.",
  "You make the small things feel like memories worth keeping.",
  "I'd still choose you on the days when choosing is hard.",
  "You're the reason I check the time and hope it's almost home.",
  "My favorite place is wherever you're being ridiculous.",
  "I love the way you explain things you're excited about.",
  "You're the calm I didn't know I was looking for.",
  "I never mind waiting when the destination is you.",
  "We're not perfect, but we're ours.",
  "You make me want to be gentle with the world.",
  "I hope we never stop finding each other funny.",
  "You're my favorite hello and my hardest goodbye.",
  "I like our quiet Sundays more than any weekend plan.",
  "Tell me about your worst day; I'll bring the blanket and stay.",
  "We built something ordinary that feels extraordinary to me.",
  "I could listen to you talk about absolutely nothing for hours.",
  "The best part of my day is the part that includes you.",
  "I'm not scared of growing old, I'm scared of doing it without you.",
  "You feel like home, and home is my favorite feeling.",
  "I love you in the way I save you the last bite.",
  "Our story is my favorite thing I never saw coming.",
  "You're my person, and that's the whole answer.",
  "Aku hafal cara kamu tertawa, bahkan sebelum kamu mulai tertawa.",
  "Kalau ada tombol untuk memperlambat waktu, aku tekan setiap kali bersamamu.",
  "Kamu tahu hal-hal tentang aku yang bahkan aku sendiri lupa.",
  "Rumah bukan alamat, tapi kamu yang menunggu di ruang tamu.",
  "Aku suka bagaimana kita bisa bertengkar soal makanan dan baikan dalam satu gigitan.",
  "Tidur lebih nyenyak kalau tahu besok masih ada kamu.",
  "Terima kasih sudah memilih untuk tetap tinggal, bahkan di hari-hari yang sulit.",
  "Kalau bahagia punya suara, mungkin mirip tawamu.",
  "Aku tidak butuh kejutan besar, cukup kamu datang tanpa diminta.",
  "Sepuluh tahun lagi, aku ingin masih bercanda bodoh bersamamu di dapur.",
  "I know your footsteps before I see you.",
  "You make me laugh mid-sentence, and I love that I can't finish.",
  "I want the boring years with you, not just the highlight reel.",
  "Your hand still fits mine like it was measured.",
  "I'd rather be a little late and walk with you.",
  "You're the first person I want to tell everything to.",
  "I like us better than any plan I had for myself.",
  "Even your grumpy mornings are my favorite mornings.",
  "I don't need a perfect life, just a life that has you in it.",
  "Some days I love you loudly, some days quietly — never any less.",
];

const QUOTE_PERIOD_HOURS = 6;
const QUOTE_PERIOD_MS = QUOTE_PERIOD_HOURS * 60 * 60 * 1000;
const HOURS_PER_DAY = 24;
const PERIODS_PER_DAY = HOURS_PER_DAY / QUOTE_PERIOD_HOURS;

function gcd(a: number, b: number): number {
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

/**
 * Stride coprime with the quote count, so one cycle visits every quote exactly
 * once. Kept at or below `count - 2` so crossing into the next cycle can never
 * land on the quote that just finished the previous one.
 */
function rotationStride(count: number): number {
  for (let k = 2; k <= count - 2; k++) {
    if (gcd(k, count) === 1) return k;
  }
  return 1;
}

/**
 * Monotonic 6-hour period counter in Asia/Jakarta (WIB).
 * Arithmetic in day-number space, so DST-free WIB and month/year rollovers are
 * automatic and every caller agrees on the same period.
 */
export function quotePeriodOrdinal(now: Date = new Date()): number {
  const parts = getJakartaParts(now);
  if (!parts) return Math.floor(now.getTime() / QUOTE_PERIOD_MS);
  // Some engines report midnight as hour 24 under hour12:false.
  const hour = parts.hour % HOURS_PER_DAY;
  const dayNumber = Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000,
  );
  return dayNumber * PERIODS_PER_DAY + Math.floor(hour / QUOTE_PERIOD_HOURS);
}

/**
 * Quote index for a period. Deterministic arithmetic rotation: the quote changes
 * every period, a full cycle covers every quote once, and the cycle start shifts
 * each cycle so the sequence never settles into a fixed repeat.
 * (No seed/hash of adjacent numbers — that kept the same index for weeks.)
 */
export function getQuoteIndex(ordinal: number, excludeIndices: number[] = []): number {
  const count = QUOTES.length;
  if (count <= 1) return 0;

  const stride = rotationStride(count);
  const cycle = Math.floor(ordinal / count);
  const position = ((ordinal % count) + count) % count;
  const base = (((cycle + position * stride) % count) + count) % count;

  for (let step = 0; step < count; step++) {
    const index = (base + step) % count;
    if (!excludeIndices.includes(index)) return index;
  }
  return base;
}

export function getQuoteOfTheDay(
  excludeIndices: number[] = [],
  now: Date = new Date(),
): string {
  return QUOTES[getQuoteIndex(quotePeriodOrdinal(now), excludeIndices)];
}

/**
 * Milliseconds until the next 6-hour WIB boundary (00:00, 06:00, 12:00, 18:00).
 * `Date.UTC` rollover keeps the midnight case correct without local Date math.
 */
export function msUntilNextQuotePeriod(now: Date = new Date()): number {
  const parts = getJakartaParts(now);
  if (!parts) {
    const remainder = now.getTime() % QUOTE_PERIOD_MS;
    return remainder === 0 ? QUOTE_PERIOD_MS : QUOTE_PERIOD_MS - remainder;
  }

  const hour = parts.hour % HOURS_PER_DAY;
  const hoursToBoundary = QUOTE_PERIOD_HOURS - (hour % QUOTE_PERIOD_HOURS);
  const boundaryUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour + hoursToBoundary - 7,
  );
  // Never return <= 0: a 0ms timeout would spin if the clock lands a hair early.
  return Math.max(boundaryUtc - now.getTime(), 1000);
}
