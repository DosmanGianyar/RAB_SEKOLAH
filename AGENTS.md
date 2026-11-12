# Aturan Agen AI (Antigravity / Gemini / Claude / Cursor)

> File ini berlaku untuk SEMUA PC tempat project ini dikerjakan.
> Ikut ter-commit ke Git agar konsisten di mana pun.

## 1. WAJIB: `git pull` di awal setiap sesi

Pemilik project bekerja dari **banyak PC**. Sebelum melakukan apa pun
(membaca, mengedit, build, atau commit) pada sesi baru:

1. Jalankan `git pull --rebase --autostash` di root repository ini.
2. Jika ada konflik, **berhenti** dan laporkan ke pengguna — jangan
   menimpa perubahan dari PC lain.
3. Setelah selesai bekerja, commit & `git push` agar PC lain mendapat
   versi terbaru.

## 2. ATURAN SERVER: JANGAN PERNAH UPDATE KE SERVER OTOMATIS

Semua perubahan dan pengujian DILARANG KERAS di-deploy/di-pull ke server
production (`36.93.15.146` / `apps-dosman`) secara otomatis!
Hanya lakukan perubahan di lingkungan lokal dan GitHub saja, sampai
ada perintah eksplisit dari pengguna untuk melakukan update ke server.

## 3. Skill yang tersedia di project ini

- `.agents/skills/prompt-master/` — membuat/memperbaiki prompt untuk
  tool AI lain (LLM, Cursor, Midjourney, coding agent, dll.).
  Sumber: https://github.com/nidhinjs/prompt-master

## 4. Gaya komunikasi

- Jawab dalam Bahasa Indonesia, ringkas.

## 5. File database: JANGAN di-commit

- `rab_sekolah.db` (dan `*.db`) masuk `.gitignore`. Jangan `git add -f` atau meng-commit database,
  KECUALI pengguna meminta secara eksplisit (mis. untuk demo).
- Saat rilis resmi, seluruh database demo akan dihapus dan dibuat baru.

