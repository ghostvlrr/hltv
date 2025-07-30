# EsportsPulse API

Bu API, Valorant ve CS:GO maçlarını canlı olarak takip etmek için geliştirilmiştir.

## Endpoints

- `GET /` - Health check
- `GET /live-matches` - VLR.gg'den canlı Valorant maçları
- `GET /hltv-matches` - HLTV.org'dan canlı CS:GO maçları

## Render Deployment

### 1. GitHub'a Yükleme

```bash
# API klasörüne git
cd scripts/api

# Git repository oluştur
git init
git add .
git commit -m "Initial commit"

# GitHub'da yeni repository oluştur ve push et
git remote add origin https://github.com/username/esportspulse-api.git
git push -u origin main
```

### 2. Render'da Deployment

1. [Render.com](https://render.com)'a git
2. "New +" butonuna tıkla
3. "Web Service" seç
4. GitHub repository'ni bağla
5. Aşağıdaki ayarları yap:

**Build Settings:**
- **Name:** `esportspulse-api`
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Environment Variables:**
- `NODE_ENV`: `production`

### 3. Puppeteer için Render Ayarları

Render'da Puppeteer çalışması için aşağıdaki environment variable'ları ekle:

```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### 4. Build Script'i

Render'da Puppeteer için gerekli Chrome'u yüklemek için build script'i:

```bash
# Build Command
npm install && npm install puppeteer
```

### 5. Health Check

API çalıştıktan sonra şu endpoint'i test et:
```
https://your-app-name.onrender.com/
```

## Local Development

```bash
# Dependencies yükle
npm install

# Development server başlat
npm run dev

# Production server başlat
npm start
```

## API Response Examples

### Live Matches (Valorant)
```json
{
  "success": true,
  "data": [
    {
      "team1": "Team Liquid",
      "team2": "Sentinels",
      "flag1": "us",
      "flag2": "us",
      "score1": "13",
      "score2": "11",
      "time_until_match": "LIVE",
      "match_series": "VCT Champions",
      "match_event": "Group Stage",
      "current_map": "Ascent",
      "stream_url": "https://twitch.tv/valorant"
    }
  ],
  "count": 1
}
```

### HLTV Matches (CS:GO)
```json
{
  "success": true,
  "data": {
    "live": [
      {
        "team1": "NAVI",
        "team2": "Vitality",
        "logo1": "https://hltv.org/img/static/team/logo/4608.png",
        "logo2": "https://hltv.org/img/static/team/logo/9565.png",
        "event": "ESL Pro League",
        "bestOf": "bo3",
        "mapsWon": ["16", "14"],
        "time": "LIVE",
        "stream": "https://twitch.tv/esl_csgo",
        "matchUrl": "https://hltv.org/matches/123456"
      }
    ],
    "upcoming": [...]
  },
  "counts": {
    "live": 1,
    "upcoming": 5
  }
}
``` 