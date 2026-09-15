# toinayxemgi — Tối nay xem gì

CS-style case opening to pick an actress to watch. Pool size 10–200, 4 rarity tiers, rare gold uses `rare.png` on the reel. No payments.

Inspired by [nagisanzenin](https://github.com/nagisanzenin) / [truanayangi](https://github.com/nagisanzenin/truanayangi).

## Development

```bash
npm install
npm run dev
npm run build
```

## Deploy lên GitHub Pages (repo cá nhân)

Giữ nguyên:
- Nút GitHub + star count → repo gốc [nagisanzenin/truanayangi](https://github.com/nagisanzenin/truanayangi)
- Counter API → `https://truanayangi-counter.nagisanzenin.workers.dev/spins` (`counter/public-config.json`)
- Footer: **Lấy cảm hứng từ** [https://github.com/nagisanzenin](https://github.com/nagisanzenin)

### 1. Tạo repo mới trên GitHub

Ví dụ tên: `toinayxemgi`  
→ URL: `https://<username>.github.io/toinayxemgi/`

### 2. Push thư mục `app/` lên repo

```powershell
cd C:\Users\Admin\Desktop\test\app
git init
git add .
git commit -m "Initial commit: Tối nay xem gì"
git branch -M main
git remote add origin https://github.com/<username>/toinayxemgi.git
git push -u origin main
```

### 3. Bật GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Source**: GitHub Actions
3. Workflow: `.github/workflows/deploy-pages.yml`
4. Đợi Actions xanh → mở `https://<username>.github.io/toinayxemgi/`

`vite.pages.config.ts` lấy tên repo từ `GITHUB_REPOSITORY` trên Actions (local mặc định `/toinayxemgi/`). Đặt tên repo khớp, hoặc sửa `REPO_NAME`.

### 4. Không cần deploy counter riêng

Giữ nguyên `counter/public-config.json` để dùng chung counter của tác giả.

## Assets

- Actresses: `public/actresses.json`, `public/actresses/*.jpg`, `public/rarity-map.json`
- Rare emblem: `public/rare.png`
- CS:GO SFX: https://github.com/sourcesounds/csgo/tree/master/sound/ui

## Counter (tùy chọn — chỉ khi tự host)

Xem `counter/README.md`.
