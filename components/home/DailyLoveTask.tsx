"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check, Sparkles, Heart, RotateCcw, ArrowRight, PartyPopper } from "lucide-react";

const tasks = [
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
];

function getTodayTask(): string {
  const start = new Date(2024, 0, 1);
  const today = new Date();
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return tasks[diff % tasks.length];
}

const streakKey = "dailylovetask-streak";

function getStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(streakKey);
    if (!raw) return 0;
    const { streak, date } = JSON.parse(raw);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const lastDate = new Date(date);
    if (lastDate.toDateString() === new Date().toDateString()) return streak;
    if (lastDate.toDateString() === yesterday.toDateString()) return streak;
    return 0;
  } catch {
    return 0;
  }
}

function saveStreak(streak: number) {
  try {
    localStorage.setItem(streakKey, JSON.stringify({ streak, date: new Date().toDateString() }));
  } catch {}
}

export default function DailyLoveTask() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [task, setTask] = useState("");
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    setTask(getTodayTask());
    setStreak(getStreak());
    try {
      const stored = localStorage.getItem("dailylovetask-done");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === new Date().toDateString()) {
          setDone(parsed.done);
        }
      }
    } catch {}
    try {
      const hist = localStorage.getItem("dailylovetask-history");
      if (hist) {
        const parsed = JSON.parse(hist);
        setHistory(parsed);
        historyRef.current = parsed;
      }
    } catch {}
  }, []);

  function isStreakCountedToday(): boolean {
    try {
      return localStorage.getItem("dailylovetask-streak-date") === new Date().toDateString();
    } catch {
      return false;
    }
  }
  function markStreakCountedToday() {
    try {
      localStorage.setItem("dailylovetask-streak-date", new Date().toDateString());
    } catch {}
  }

  const handleDone = () => {
    const newDone = !done;
    setDone(newDone);
    try {
      localStorage.setItem(
        "dailylovetask-done",
        JSON.stringify({ date: new Date().toDateString(), done: newDone }),
      );
    } catch {}
    if (newDone) {
      if (!historyRef.current.includes(task)) {
        const newHistory = [...historyRef.current, task];
        setHistory(newHistory);
        historyRef.current = newHistory;
        try {
          localStorage.setItem("dailylovetask-history", JSON.stringify(newHistory));
        } catch {}
      }
      if (!isStreakCountedToday()) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        saveStreak(newStreak);
        markStreakCountedToday();
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      const filtered = historyRef.current.filter((h) => h !== task);
      if (filtered.length !== historyRef.current.length) {
        setHistory(filtered);
        historyRef.current = filtered;
        try {
          localStorage.setItem("dailylovetask-history", JSON.stringify(filtered));
        } catch {}
      }
    }
  };

  const handleRefresh = () => {
    const exclude = new Set([task, ...historyRef.current]);
    let available = tasks.filter((t) => !exclude.has(t));
    if (available.length === 0) {
      available = tasks.filter((t) => t !== task);
    }
    const idx = Math.floor(Math.random() * available.length);
    setTask(available[idx]);
    setDone(false);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{
                x: "50%",
                y: "100%",
                opacity: 1,
                scale: 0,
              }}
              animate={{
                x: `${20 + Math.random() * 60}%`,
                y: `${-10 + Math.random() * -60}%`,
                opacity: 0,
                scale: 1 + Math.random(),
                rotate: Math.random() * 360,
              }}
              transition={{ duration: 1 + Math.random(), ease: "easeOut" }}
              className="absolute text-lg"
              style={{ bottom: 0 }}
            >
              {["🌸", "✨", "💖", "🌟", "🎉", "💫", "🌺", "⭐"][i % 8]}
            </motion.span>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-base font-medium">Daily Love Task</span>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              <PartyPopper className="h-3 w-3" />
              {streak} hari
            </motion.div>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Selanjutnya"
          >
            <ArrowRight className="h-3 w-3" />
            New Task
          </button>
        </div>
      </div>

      <motion.div
        className="rounded-xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-primary/[0.01] p-5"
        animate={done ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Heart className={done ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4 text-primary"} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-sm uppercase tracking-wider text-muted-foreground">
              Tugas hari ini:
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${done ? "text-muted-foreground" : "text-foreground font-medium"}`}>
              {done ? <span className="line-through">{task}</span> : task}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="mt-4 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDone}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-all ${
            done
              ? "bg-primary/10 text-primary ring-1 ring-primary/20"
              : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md"
          }`}
        >
          {done ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              Batalkan
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Kerjakan & Tandai selesai
            </>
          )}
        </motion.button>
        {done && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            Great job!
          </motion.span>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Riwayat selesai ({history.length})</span>
          <div className="mt-2 flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {[...history].reverse().map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-1.5"
              >
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="text-xs text-muted-foreground line-through">{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
