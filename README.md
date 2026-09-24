# Love Quest 💖

Game web lucu yang bisa di-custom pembeli untuk pasangannya: 5 dunia × 12 game yang beda-beda (60 level) + 5 bonus puzzle foto,
13 jenis mini-game, muka pasangan jadi karakter game, streak berdua + notifikasi, dan bisa dimainin offline.

| Alamat | Isi |
|---|---|
| `/` | Demo untuk calon pembeli (isi nama, foto & muka sendiri, Dunia 1 terbuka, contoh streak, info paket) |
| `/c/<kode>` | Game milik satu pasangan, isinya dimuat dari CMS |
| `/admin` | CMS: pembeli login lalu ganti nama, lagu, foto, surat, pesan tiap level, kuis, dan (paket Premium) tema & karakter |
| `/owner` | Halaman owner: bikin akun pembeli + paketnya, perpanjang langganan, ganti password, hapus akun |

Tes lokal: `/?c=<kode>` sama dengan `/c/<kode>`, dan `/admin.html?contoh` membuka editor tanpa login (nggak menyimpan apa pun).

## Setup CMS (Supabase)

Pakai project Supabase **baru** khusus bisnis ini.

1. **SQL Editor → New query**: paste isi `supabase/schema.sql`, lalu **Run**.
2. **Authentication → Sign In / Providers → Email**: pastikan aktif. Akun pembeli dibuat dari `/owner` (langsung terkonfirmasi, tanpa email).
3. **Project Settings → API**: salin Project URL & publishable key ke `cloud.url` dan `cloud.anonKey` di `js/config.js`.

Keamanan:
- Isi game cuma bisa diambil lewat kodenya (`get_couple`), nggak ada cara melihat daftar semua game.
- Pembeli cuma bisa melihat & mengubah game miliknya sendiri, dan cuma bisa upload foto ke foldernya sendiri.

## Setup tahap 2 (langganan, owner, tema, streak)

1. **SQL Editor**: jalankan `supabase/migration-2.sql`, tapi ganti dulu `GANTI_DENGAN_EMAIL_KAMU` di baris terakhir dengan email akun CMS kamu.
2. **Edge Functions → Deploy a new function → Via Editor**: nama **`streak-push`** (persis), paste `supabase/functions/streak-push/index.ts`, deploy, lalu matikan **Verify JWT**.
3. **Edge Functions → Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:email-kamu`), `CRON_SECRET`.
4. **SQL Editor**: jalankan `supabase/cron.sql` (ganti `ISI_CRON_SECRET`).

5. **SQL Editor**: jalankan `supabase/migration-3.sql` (biar main pas offline tetap kecatat di streak dengan tanggal yang benar).
6. **SQL Editor**: jalankan `supabase/migration-4.sql` (muka jadi karakter & pilihan lagu cuma buat paket Premium).

7. **SQL Editor**: jalankan `supabase/migration-5.sql` (pembeli nggak bisa bikin akun/game sendiri lagi).
8. **Edge Functions → Deploy a new function → Via Editor**: nama **`owner-accounts`** (persis), paste `supabase/functions/owner-accounts/index.ts`, deploy, lalu matikan **Verify JWT** (fungsinya ngecek admin sendiri). Nggak butuh secret tambahan.
9. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up**, biar akun cuma bisa dibuat dari `/owner`.
10. **SQL Editor**: jalankan `supabase/migration-6.sql` (logo aplikasi dari foto cuma buat paket Premium). Manifest per pasangan dilayani `api/manifest.js` (Vercel Function, otomatis ke-deploy).

Alur jualan: pembeli bayar lewat WhatsApp → kamu buka `/owner` → **➕ Tambah akun pembeli** (email, password, paket, masa aktif) → salin pesan login yang muncul dan kirim ke pembeli. Perpanjang pakai **+30 hari** / **+1 tahun**, ganti paket ke Premium, ganti password, atau hapus akun dari kartu tiap pembeli. Kalau lewat tanggal, game pasangan otomatis terkunci.

## Menulis konten

Di teks mana pun, `{pasangan}` dan `{pengirim}` otomatis diganti nama yang diisi di CMS. `{karakter}`/`{karakter2}` jadi emoji karakter, `{suara}` jadi suara karakter pemandu.

## Lagu

Lagu latar disintesis langsung di browser (`js/music.js`): Ceria, Santai, Romantis, Lucu. Bebas hak cipta, tanpa file mp3.

## Mode tes

Tambahkan `?bukasemua` untuk membuka semua level.

## Jalankan lokal

```bash
python3 -m http.server 5179
```

## Deploy

Situs statis, bisa langsung di-deploy ke Vercel (framework: Other, tanpa build command). `vercel.json` sudah mengatur `/c/<kode>` dan `/admin`.
