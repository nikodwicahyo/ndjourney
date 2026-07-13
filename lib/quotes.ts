import { seededRandom } from "./utils";
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
  "I love you more than chicken. And that's serious.",
  "Every love story is beautiful, but ours is my favorite.",
  "Home is wherever I'm with you.",
  "You're the peanut butter to my jelly.",
  "I didn't believe in love at first sight until I met you.",
  "You make my heart smile.",
  "I'd pick you every time. Every lifetime.",
  "You're the best thing that's ever been mine.",
  "I love you to the moon and back.",
];

const LS_KEY = "quotes-shown";

export function loadShownQuoteIndices(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShownQuoteIndex(index: number) {
  try {
    const shown = loadShownQuoteIndices();
    if (!shown.includes(index)) {
      shown.push(index);
      localStorage.setItem(LS_KEY, JSON.stringify(shown));
    }
  } catch {}
}

export function resetShownQuotes() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export function getQuoteOfTheDay(excludeIndices?: number[]): string {
  const d = new Date();
  const parts = getJakartaParts(d);

  const available = excludeIndices && excludeIndices.length < QUOTES.length
    ? QUOTES.map((_, i) => i).filter(i => !excludeIndices.includes(i))
    : QUOTES.map((_, i) => i);

  let period: number;
  let daySeed: number;

  if (parts) {
    period = Math.floor(parts.hour / 4);
    daySeed = (parts.year * 10000 + parts.month * 100 + parts.day) * 6 + period;
  } else {
    period = Math.floor(d.getHours() / 4);
    daySeed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 6 + period;
  }

  const rng = seededRandom(daySeed);
  return QUOTES[available[Math.floor(rng() * available.length)]];
}
