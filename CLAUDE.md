# CLAUDE.md — Agent & Development Guide for E-RAB Sekolah

## Aplikasi E-RAB Sekolah — SMAN 1 Gianyar
- **Server:** Proxmox LXC Container `110` (`apps-dosman`)
- **Deployment:** Git pull + PM2 restart via `plink`

---

## ⚡ ATURAN UTAMA: LOCAL & GITHUB ONLY (DILARANG UPDATE SERVER OTOMATIS)

> [!WARNING]
> **DILARANG DEPLOY OTOMATIS KE SERVER:**
> Perubahan hanya dilakukan di lingkungan **Lokal & GitHub** saja.
> AI Agent **DILARANG KERAS** menjalankan deploy/pull ke server production (`apps-dosman` / `36.93.15.146`)
> kecuali pengguna secara eksplisit memberikan perintah untuk melakukan update server!

> [!IMPORTANT]
> **KETIKA USER MENGETIK `claude.md`:**
> AI Agent menjalankan commit & push ke GitHub:
> 1. Stage semua perubahan: `git add .`
> 2. Buat commit: `git commit -m "<deskripsi_perubahan_terbaru>"`
> 3. Push ke GitHub: `git push origin main`
> *(Langkah deploy ke server HANYA dijalankan jika diminta secara spesifik oleh pengguna)*

---

## 🔑 Kredensial & Informasi Server Satelit (Proxmox LXC)

| Parameter | Nilai |
| :--- | :--- |
| **Node Proxmox Host** | `100.102.109.39` (`proxmox-8006`) |
| **Container ID** | `110` (`apps-dosman`) |
| **URL Web Publik E-RAB** | **`http://36.93.15.146:3000`** |
| **URL Web Publik Suka Duka** | **`http://36.93.15.146:3001`** |
| **Host / IP Tailscale** | `100.76.239.63` (`apps-dosman`) |
| **IP Lokal Rack** | `192.168.50.246` (DHCP Static Lease di MikroTik) |
| **Router MikroTik** | `192.168.50.1` (RB3011UiAS) |
| **Path Proyek di Server** | `/home/dosman/apps/rab` |
| **SSH Username** | `dosman` |
| **SSH & Sudo Password** | `Dosman123` |
| **Host Key Fingerprint (`plink`)**| `SHA256:jFKUNtW1LhnnH0PJM4Jr5lbXhEYxYOzg4iFdlbsb2hI` |
| **Branch Utama** | `main` |
| **Git Remote** | `origin` (`https://github.com/DosmanGianyar/RAB_SEKOLAH.git`) |
| **PM2 Process Name** | `rab` |

---

## 💻 Perintah Sekali Jalan (All-in-One One-Liner PowerShell)

Jika ingin menjalankan secara manual di terminal PowerShell Windows:

```powershell
git add . ; git commit -m "deploy: update aplikasi rab sekolah" ; git push origin main ; plink -batch -hostkey "SHA256:jFKUNtW1LhnnH0PJM4Jr5lbXhEYxYOzg4iFdlbsb2hI" -pw Dosman123 dosman@100.76.239.63 "cd /home/dosman/apps/rab && git pull origin main && npm install --omit=dev && pm2 restart rab"
```

---

## 🛠️ Stack & Arsitektur
- **OS:** Ubuntu 24.04 LTS (Noble Numbat)
- **Runtime:** Node.js v22.23.4 LTS + Express.js
- **Process Manager:** PM2 (auto-start on boot via systemd `pm2-dosman`)
- **Port E-RAB:** 3000 (Langsung dari Dst-NAT MikroTik Port 3000)
- **Port Suka Duka:** 3005 (Nginx Reverse Proxy Port 80 <- Dst-NAT MikroTik Port 3001)
- **Database:** SQLite 3 (`rab_sekolah.db`)



## Aturan Sesi (lihat juga AGENTS.md)

- **WAJIB** jalankan `git pull --rebase --autostash` di awal setiap sesi sebelum mengerjakan apa pun (project dikerjakan dari banyak PC).
- Skill prompt engineering tersedia di `.agents/skills/prompt-master/`.

