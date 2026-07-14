import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const QUOTES = [
  // Indonesian quotes
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
  "Aku tidak perlu sempurna, karena cintamu sudah cukup.",
  "Kamu adalah pelangi di hari-hari kelamku.",
  "Cinta bukan tentang berapa lama kita bersama, tapi tentang seberapa berarti kita untuk satu sama lain.",
  "Aku suka cara kamu melihatku, seolah aku adalah satu-satunya orang di dunia ini.",
  "Setiap hari bersamamu adalah hadiah terindah.",
  "Kamu adalah kata sandi hatiku.",
  "Aku dan kamu, seperti bintang dan bulan — selalu bersama meski terpisah jarak.",
  "Bersamamu, aku menemukan arti rumah yang sesungguhnya.",
  "Kamu adalah alasan aku bangun setiap pagi dengan senyuman.",
  "Cinta kita adalah puisi yang tak pernah usai.",
  "Aku mencintaimu bukan karena siapa kamu, tapi karena siapa aku saat bersamamu.",
  "Kamu adalah bagian terindah dalam hidupku.",
  "Beribu kata cinta takkan cukup untuk menggambarkan perasaanku padamu.",
  "Sederhana bersamamu, berarti selamanya.",
  // English/ mixed quotes
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
  "You are the piece of my heart I never knew was missing.",
  "In a sea of people, my eyes will always find you.",
  "Every moment with you is a treasure I hold close to my heart.",
  "You're not just my love, you're my best friend.",
  "Falling for you was the bravest thing I've ever done.",
  "You're the reason I believe in forever.",
  "I never knew what happiness was until I found you.",
  "You're my favorite hello and my hardest goodbye.",
  "The best thing to hold onto in life is each other.",
  "You're the answer to every question in my heart.",
  "If I had a flower for every time I thought of you, I'd walk in an eternal garden.",
  "Loving you is the best decision I've ever made.",
  "You're my safe place, my happy place, my favorite place.",
  "Some people are worth melting for — you're one of them.",
  "I knew I loved you before I met you.",
  "You're the closest thing to heaven I've ever known.",
  "Together is the most beautiful place I've ever been.",
  "You're the light that guides me home.",
  "My heart is, and always will be, yours.",
  "You had me at hello.",
];

const WYR_QUESTIONS = [
  // Existing questions
  { question: "Liburan ke pantai atau gunung?", optionA: "Pantai", optionB: "Gunung", category: "Liburan" },
  { question: "Nonton Netflix atau jalan-jalan?", optionA: "Netflix", optionB: "Jalan-jalan", category: "Aktivitas" },
  { question: "Masak bareng atau pesan GO-FOOD?", optionA: "Masak bareng", optionB: "GO-FOOD", category: "Makanan" },
  { question: "Kado romantis atau surprise party?", optionA: "Kado romantis", optionB: "Surprise party", category: "Kejutan" },
  { question: "Cuddling di rumah atau date outdoor?", optionA: "Cuddling", optionB: "Date outdoor", category: "Aktivitas" },
  { question: "Sarapan di tempat favorit atau brunch di tempat baru?", optionA: "Tempat favorit", optionB: "Tempat baru", category: "Makanan" },
  { question: "Beli bunga atau tulis surat?", optionA: "Beli bunga", optionB: "Tulis surat", category: "Romantis" },
  { question: "Jalan pagi lihat sunrise atau jalan malam lihat bintang?", optionA: "Sunrise", optionB: "Bintang", category: "Aktivitas" },
  { question: "Main game bareng atau nonton film?", optionA: "Game", optionB: "Nonton film", category: "Aktivitas" },
  { question: "Karaoke duet atau dance bareng?", optionA: "Karaoke", optionB: "Dance", category: "Aktivitas" },
  { question: "Piknik di taman atau picnic di rooftop?", optionA: "Taman", optionB: "Rooftop", category: "Liburan" },
  { question: "Kucing atau anjing?", optionA: "Kucing", optionB: "Anjing", category: "Hewan" },
  { question: "Kopi atau teh?", optionA: "Kopi", optionB: "Teh", category: "Minuman" },
  { question: "Es krim atau kue?", optionA: "Es krim", optionB: "Kue", category: "Makanan" },
  { question: "Baca buku atau dengerin podcast bareng?", optionA: "Baca buku", optionB: "Podcast", category: "Aktivitas" },
  { question: "Staycation di hotel mewah atau glamping di alam?", optionA: "Hotel mewah", optionB: "Glamping", category: "Liburan" },
  { question: "Buat playlist bersama atau bikin scrapbook?", optionA: "Playlist", optionB: "Scrapbook", category: "Romantis" },
  { question: "Jalan-jalan ke mall atau ke museum?", optionA: "Mall", optionB: "Museum", category: "Aktivitas" },
  { question: "Makan pedas atau manis?", optionA: "Pedas", optionB: "Manis", category: "Makanan" },
  { question: "Liburan ke luar negeri atau staycation di Indonesia?", optionA: "Luar negeri", optionB: "Di Indonesia", category: "Liburan" },
  // New questions
  { question: "Makanan gurih atau makanan manis?", optionA: "Gurih", optionB: "Manis", category: "Makanan" },
  { question: "Hujan-hujanan atau main salju?", optionA: "Hujan-hujanan", optionB: "Main salju", category: "Aktivitas" },
  { question: "Jalan kaki naik gunung atau berenang di laut?", optionA: "Naik gunung", optionB: "Berenang", category: "Aktivitas" },
  { question: "Vintage aesthetic atau modern minimalist?", optionA: "Vintage", optionB: "Minimalis", category: "Gaya" },
  { question: "Foto polaroid atau foto digital?", optionA: "Polaroid", optionB: "Digital", category: "Romantis" },
  { question: "Cincin emas atau cincin perak?", optionA: "Emas", optionB: "Perak", category: "Romantis" },
  { question: "Malam mingguan di rumah atau party?", optionA: "Di rumah", optionB: "Party", category: "Aktivitas" },
  { question: "Bunga mawar atau bunga tulip?", optionA: "Mawar", optionB: "Tulip", category: "Romantis" },
  { question: "Jalan-jalan naik mobil atau naik motor?", optionA: "Mobil", optionB: "Motor", category: "Liburan" },
  { question: "Sarapan di kasur atau picnic pagi?", optionA: "Sarapan di kasur", optionB: "Picnic pagi", category: "Romantis" },
  { question: "Beli kado surprise atau bikin kado handmade?", optionA: "Kado surprise", optionB: "Handmade", category: "Kejutan" },
  { question: "Jalan-jalan ke pantai atau ke danau?", optionA: "Pantai", optionB: "Danau", category: "Liburan" },
  { question: "Musim panas atau musim dingin?", optionA: "Musim panas", optionB: "Musim dingin", category: "Liburan" },
  { question: "Main teka-teki atau main puzzle?", optionA: "Teka-teki", optionB: "Puzzle", category: "Aktivitas" },
  // Romantic/deep questions
  { question: "Peluk erat atau genggam tangan?", optionA: "Peluk erat", optionB: "Genggam tangan", category: "Romantis" },
  { question: "Cipika-cipiki atau peluk lama?", optionA: "Cipika-cipiki", optionB: "Peluk lama", category: "Romantis" },
  { question: "Jalan sambil gandengan atau duduk berdua sambil ngobrol?", optionA: "Jalan gandengan", optionB: "Duduk ngobrol", category: "Romantis" },
  { question: "Pasangan yang humoris atau pasangan yang romantis?", optionA: "Humoris", optionB: "Romantis", category: "Pasangan" },
  { question: "Pasangan yang cuek tapi perhatian atau pasangan yang perhatian berlebihan?", optionA: "Cuek tapi perhatian", optionB: "Perhatian berlebihan", category: "Pasangan" },
  { question: "Sifat fisik atau sifat kepribadian yang lebih menarik?", optionA: "Fisik", optionB: "Kepribadian", category: "Pasangan" },
  { question: "Kencan surprise atau kencan yang direncanakan?", optionA: "Surprise", optionB: "Terencana", category: "Kencan" },
  { question: "Kencan pagi hari atau kencan malam hari?", optionA: "Pagi hari", optionB: "Malam hari", category: "Kencan" },
  { question: "Berkencan di tempat ramai atau tempat sepi?", optionA: "Tempat ramai", optionB: "Tempat sepi", category: "Kencan" },
  { question: "Jalan-jalan ke pantai atau ke taman bunga?", optionA: "Pantai", optionB: "Taman bunga", category: "Liburan" },
  { question: "Liburan yang santai atau liburan yang penuh petualangan?", optionA: "Santai", optionB: "Petualangan", category: "Liburan" },
  { question: "Naik gunung atau main air terjun?", optionA: "Naik gunung", optionB: "Air terjun", category: "Aktivitas" },
  { question: "Bersepeda santai atau lari pagi bareng?", optionA: "Bersepeda", optionB: "Lari pagi", category: "Aktivitas" },
  { question: "Nonton drakor atau nonton anime bareng?", optionA: "Drakor", optionB: "Anime", category: "Film" },
  { question: "Film horor atau film komedi?", optionA: "Horor", optionB: "Komedi", category: "Film" },
  { question: "Musik slow atau musik upbeat?", optionA: "Slow", optionB: "Upbeat", category: "Musik" },
  { question: "Penyanyi luar negeri atau penyanyi dalam negeri?", optionA: "Luar negeri", optionB: "Dalam negeri", category: "Musik" },
  { question: "Konser musik atau festival seni?", optionA: "Konser", optionB: "Festival", category: "Aktivitas" },
  { question: "Makanan Indonesia atau makanan Jepang?", optionA: "Indonesia", optionB: "Jepang", category: "Makanan" },
  { question: "Makanan China atau makanan Korea?", optionA: "China", optionB: "Korea", category: "Makanan" },
];

interface TriviaData {
  question: string;
  answer: string;
  category: string;
}

const TRIVIA_QUESTIONS: TriviaData[] = [
  // Category: Makanan (Food) — 12 questions
  { question: "Apa makanan favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Apa minuman favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Apa makanan yang paling tidak disukai pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Apa topping chicken favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Pasanganmu lebih suka kopi pahit atau kopi susu?", answer: "none", category: "Makanan" },
  { question: "Apa camilan favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Di restoran apa kencan pertama kalian?", answer: "none", category: "Makanan" },
  { question: "Apa dessert favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Pasanganmu suka pedas level berapa?", answer: "none", category: "Makanan" },
  { question: "Apa sarapan favorit pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Buah apa yang paling disukai pasanganmu?", answer: "none", category: "Makanan" },
  { question: "Apa mie instan favorit pasanganmu?", answer: "none", category: "Makanan" },
  // Category: Film (Movies) — 12 questions
  { question: "Apa film favorit pasanganmu sepanjang masa?", answer: "none", category: "Film" },
  { question: "Genre film apa yang paling disukai pasanganmu?", answer: "none", category: "Film" },
  { question: "Film apa yang terakhir ditonton pasanganmu?", answer: "none", category: "Film" },
  { question: "Siapa aktor/aktris favorit pasanganmu?", answer: "none", category: "Film" },
  { question: "Film apa yang bikin pasanganmu nangis?", answer: "none", category: "Film" },
  { question: "Film apa yang paling sering ditonton ulang pasanganmu?", answer: "none", category: "Film" },
  { question: "Film Disney favorit pasanganmu?", answer: "none", category: "Film" },
  { question: "Apa film horor favorit pasanganmu?", answer: "none", category: "Film" },
  { question: "Film apa yang ingin ditonton pasanganmu saat ini?", answer: "none", category: "Film" },
  { question: "Serial TV apa yang paling disukai pasanganmu?", answer: "none", category: "Film" },
  { question: "Film animasi favorit pasanganmu?", answer: "none", category: "Film" },
  { question: "Sutradara favorit pasanganmu?", answer: "none", category: "Film" },
  // Category: Tempat (Places) — 12 questions
  { question: "Dimana tempat pertama kali kalian bertemu?", answer: "none", category: "Tempat" },
  { question: "Apa tempat favorit pasanganmu untuk bersantai?", answer: "none", category: "Tempat" },
  { question: "Negara apa yang paling ingin dikunjungi pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Kota favorit pasanganmu di Indonesia?", answer: "none", category: "Tempat" },
  { question: "Tempat apa yang paling nyaman buat pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Apa tempat kencan favorit kalian?", answer: "none", category: "Tempat" },
  { question: "Cafe favorit pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Tempat liburan impian pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Mall favorit pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Tempat yang paling dihindari pasanganmu?", answer: "none", category: "Tempat" },
  { question: "Tempat favorit pasanganmu waktu kecil?", answer: "none", category: "Tempat" },
  { question: "Pantai favorit pasanganmu?", answer: "none", category: "Tempat" },
  // Category: Random — 12 questions
  { question: "Apa warna favorit pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa hewan favorit pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa hal yang paling ditakutkan pasanganmu?", answer: "none", category: "Random" },
  { question: "Berapa nomor sepatu pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa cita-cita pasanganmu waktu kecil?", answer: "none", category: "Random" },
  { question: "Apa lagu favorit pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa hobby pasanganmu?", answer: "none", category: "Random" },
  { question: "Kapan terakhir kali pasanganmu nangis?", answer: "none", category: "Random" },
  { question: "Apa hal yang paling membuat pasanganmu bahagia?", answer: "none", category: "Random" },
  { question: "Apa bakat terpendam pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa hal yang paling mengesalkan pasanganmu?", answer: "none", category: "Random" },
  { question: "Apa yang pasanganmu lakukan saat lagi gabut?", answer: "none", category: "Random" },
];

const TRUTH_CARDS = [
  "Apa momen paling berkesan bersama aku?",
  "Apa hal pertama yang kamu suka dari aku?",
  "Kapan pertama kali kamu merasa jatuh cinta?",
  "Apa ketakutan terbesarmu dalam hubungan ini?",
  "Apa hal yang paling kamu syukuri tentang aku?",
  "Apa impian terliarmu tentang masa depan kita?",
  "Apa yang kamu pikirkan saat pertama kali lihat fotoku?",
  "Apa hal terbodoh yang pernah kamu lakukan karena cinta?",
  "Apa kebiasaan kecilku yang kamu suka?",
  "Apa lagu yang mengingatkanmu padaku?",
  "Apa momen paling lucu yang kita alami bersama?",
  "Apa hal yang kamu ingin aku lakukan lebih sering?",
  "Apa kekhawatiranmu tentang hubungan kita?",
  "Apa kenangan masa kecil yang ingin kamu bagi dengan aku?",
  "Apa yang kamu suka dari cara kita menyelesaikan masalah?",
  "Apa hal yang membuatmu merasa paling dicintai?",
  "Jika bisa mengulang satu hari bersamaku, hari apa yang akan kamu pilih?",
  "Apa ketakutan terbesarmu tentang masa depan kita?",
  "Apa hal paling romantis yang pernah aku lakukan untukmu?",
  "Apa yang pertama kali kamu pikirkan saat bangun tidur?",
  "Apa satu hal tentang dirimu yang belum kamu ceritakan padaku?",
  "Kapan terakhir kali kamu merasa sangat bangga jadi pasanganku?",
  "Apa yang kamu suka dari caraku mencintai kamu?",
  "Apa kenangan paling indah bersama kita sejauh ini?",
];

const DARE_CARDS = [
  "Kirim voice note bilang 'Aku sayang kamu'",
  "Tulis puisi 4 baris tentang aku sekarang!",
  "Kirim foto selfie kamu sekarang!",
  "Nyanyikan lagu favorit kita dan kirim rekamannya!",
  "Buat playlist 3 lagu yang mengingatkanmu padaku",
  "Kirim pesan bilang 3 hal yang kamu suka dari aku",
  "Ceritakan memori pertamamu tentang aku dalam 1 menit",
  "Masak sesuatu untuk kita (dan kirim fotonya!)",
  "Ajak aku virtual date — pilih film dan streaming bareng",
  "Tulis surat cinta 100 kata untuk aku",
  "Buat drawing/doodle tentang kita",
  "Kirim screenshot chat lucu kita",
  "Rencanakan surprise date untuk minggu depan",
  "Beli hadiah kecil buat aku dan kirim fotonya",
  "Post story IG tentang kita (boleh private)",
  "Kirim pesan tebak-tebakan romantis ke aku",
  "Bacakan quote cinta favoritmu dengan suara paling romantis",
  "Tirukan suara aku dan buat aku tertawa!",
  "Rencanakan menu dinner romantis untuk minggu ini",
  "Buat video pendek bilang 5 alasan kenapa kamu cinta aku",
  "Lakukan dance random selama 30 detik dan kirim videonya",
  "Tulis nama aku 10 kali dengan gaya tulisan yang berbeda",
  "Kirim meme lucu yang menggambarkan hubungan kita",
  "Buat komik strip pendek tentang momen lucu kita",
];

const DATE_IDEAS = [
  "Nonton Netflix bareng",
  "Makan malam romantis di rumah",
  "Jalan-jalan ke mall",
  "Piknik di taman",
  "Masak bareng",
  "Staycation di hotel",
  "Main board game",
  "Karaoke berdua",
  "Nonton film di bioskop",
  "Jalan pagi sambil minum kopi",
  "Baking kue bersama",
  "Berkebun bareng",
  "Bikin scrapbook kenangan",
  "Nonton sunset di pantai",
  "Berkemah di halaman rumah",
  "Kunjungi museum/ galeri seni",
  "Bersepeda keliling kota",
  "Piknik malam sambil lihat bintang",
  "Karaoke mobil",
  "Buat foto album bersama",
  "Cooking challenge",
  "DIY craft bareng",
  "Baca buku bersama-sama",
  "Tukar kado kejutan",
  "Buat time capsule bersama",
  "Zoo atau aquarium",
  "Main game online bersama",
  "Belajar skill baru bareng (tari, bahasa, dll)",
  "Spa / relaksasi di rumah",
  "Jalan-jalan ke pasar tradisional",
  "Pottery atau lukis bersama",
  "Trekking atau hiking",
  "Baking challenge — siapa paling enak",
  "Tukar pakaian — dress like each other",
  "Buat video TikTok bersama",
  "Coba restoran baru setiap minggu",
  "Karaoke包厢 (private room)",
  "Buat podcast tentang cerita kita",
  "Main escape room online",
  "Baca buku yang sama dan diskusi",
];

const CATEGORIES: Record<string, string[]> = {
  Makanan: ["Makanan", "Makanan", "Makanan", "Minuman", "Makanan"],
  Film: ["Film", "Film", "Film", "Film"],
  Tempat: ["Tempat", "Tempat", "Tempat", "Tempat"],
  Random: ["Random", "Random", "Random"],
};

async function seedGameQuestions() {
  await prisma.gameQuestion.createMany({
    data: WYR_QUESTIONS.map((q) => ({
      type: "WOULD_YOU_RATHER",
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      category: q.category,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ ${WYR_QUESTIONS.length} Would You Rather questions seeded`);

  await prisma.gameQuestion.createMany({
    data: TRIVIA_QUESTIONS.map((q) => ({
      type: "TRIVIA",
      question: q.question,
      answer: q.answer,
      category: q.category,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ ${TRIVIA_QUESTIONS.length} Trivia questions seeded`);

  await prisma.gameQuestion.createMany({
    data: TRUTH_CARDS.map((card) => ({
      type: "TRUTH_OR_DARE",
      question: card,
      category: "Truth",
    })),
    skipDuplicates: true,
  });
  console.log(`✅ ${TRUTH_CARDS.length} Truth cards seeded`);

  await prisma.gameQuestion.createMany({
    data: DARE_CARDS.map((card) => ({
      type: "TRUTH_OR_DARE",
      question: card,
      category: "Dare",
    })),
    skipDuplicates: true,
  });
  console.log(`✅ ${DARE_CARDS.length} Dare cards seeded`);

  await prisma.gameQuestion.createMany({
    data: DATE_IDEAS.map((idea) => ({
      type: "SPIN_THE_WHEEL",
      question: idea,
      category: "Date Idea",
    })),
    skipDuplicates: true,
  });
  console.log(`✅ ${DATE_IDEAS.length} Date ideas seeded`);

  await prisma.gameQuestion.createMany({
    data: [
      { type: "SLIDING_PUZZLE", question: "Puzzle — tukar posisi kotak foto favorit dari galeri", category: "Puzzle" },
      { type: "LOVE_DARTS", question: "Darts — lempar panah ke target", category: "Arcade" },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Arcade game types seeded`);
}

function getEnv(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

async function main() {
  console.log("🌱 Seeding database...");

  const rawPassword = getEnv("SEED_PASSWORD", "couple123");
  const hashedPassword = await bcrypt.hash(rawPassword, 12);

  const adminEmail = getEnv("ADMIN_EMAIL", "admin@couple.app");
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log(`✅ Admin user created: ${adminEmail} / ${rawPassword}`);
  } else {
    console.log(`ℹ️  Admin user already exists, skipping`);
  }

  const partner1Email = getEnv("PARTNER1_EMAIL", "partner1@couple.app");
  const partner2Email = getEnv("PARTNER2_EMAIL", "partner2@couple.app");
  const existingPartner1 = await prisma.user.findUnique({ where: { email: partner1Email } });
  const existingPartner2 = await prisma.user.findUnique({ where: { email: partner2Email } });

  if (!existingPartner1) {
    await prisma.user.create({
      data: {
        name: "Partner 1",
        email: partner1Email,
        password: hashedPassword,
        role: "PARTNER",
      },
    });
    console.log(`✅ Partner 1 created: ${partner1Email} / ${rawPassword}`);
  } else {
    console.log(`ℹ️  Partner 1 already exists, skipping`);
  }

  if (!existingPartner2) {
    await prisma.user.create({
      data: {
        name: "Partner 2",
        email: partner2Email,
        password: hashedPassword,
        role: "PARTNER",
      },
    });
    console.log(`✅ Partner 2 created: ${partner2Email} / ${rawPassword}`);
  } else {
    console.log(`ℹ️  Partner 2 already exists, skipping`);
  }

  const allPartners = await prisma.user.findMany({
    where: { role: "PARTNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (allPartners.length === 2) {
    const existingCoupleMember = await prisma.coupleMember.findFirst({
      where: { userId: allPartners[0].id },
    });

    if (!existingCoupleMember) {
      const couple = await prisma.couple.create({ data: {} });
      await prisma.coupleMember.createMany({
        data: allPartners.map((p) => ({
          coupleId: couple.id,
          userId: p.id,
        })),
      });
      console.log(`✅ Couple created with ${allPartners.length} members`);
    } else {
      console.log(`ℹ️  Couple already exists, skipping`);
    }
  } else {
    console.log(`ℹ️  Expected 2 PARTNER users for couple, found ${allPartners.length}, skipping couple creation`);
  }

  console.log(`✅ ${QUOTES.length} romantic quotes loaded (used by Quote of the Day)`);

  await seedGameQuestions();

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
