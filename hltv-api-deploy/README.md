# HLTV API - EsportsPulse Mobile App

Bu API, HLTV.org'dan CS:GO maç verilerini çekmek için kullanılır ve EsportsPulse mobil uygulaması tarafından kullanılır.

## 🚀 Render Deployment

Bu API'yi Render'da deploy etmek için:

1. **GitHub'a yükleyin:**
   ```bash
   git add .
   git commit -m "Add HLTV API for Render deployment"
   git push origin main
   ```

2. **Render'da yeni servis oluşturun:**
   - Render Dashboard'a gidin
   - "New +" > "Web Service" seçin
   - GitHub repository'nizi bağlayın
   - Root Directory: `scripts/api` olarak ayarlayın
   - Build Command: `npm install`
   - Start Command: `node hltv.js`

3. **Environment Variables:**
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render otomatik olarak ayarlar)

## 📡 API Endpoints

### GET `/hltv`
Temel maç verilerini döndürür.

### GET `/hltv/basic`
Maç verilerini matchId ve isLive bilgileriyle birlikte döndürür.

### GET `/hltv/streams/:matchId`
Belirli bir maç için stream bilgilerini döndürür.

### GET `/hltv/match/:matchId`
Belirli bir maçın detaylarını stream bilgileriyle birlikte döndürür.

### GET `/health`
API'nin durumunu kontrol eder.

### POST `/clear-cache`
Cache'i temizler.

## 🔧 Local Development

```bash
# Dependencies yükleyin
npm install

# Development modunda çalıştırın
npm run dev

# Production modunda çalıştırın
npm start
```

## 📊 Response Format

```json
{
  "liveMatches": [
    {
      "team1": "NAVI",
      "team2": "Vitality",
      "event": "ESL Pro League Season 19",
      "bestOf": "bo3",
      "time": "15:30",
      "isLive": true,
      "matchId": "12345",
      "logo1": "https://...",
      "logo2": "https://...",
      "streamUrl": "https://www.hltv.org/live?matchId=12345"
    }
  ],
  "upcomingMatches": [
    {
      "team1": "FaZe",
      "team2": "G2",
      "event": "BLAST Premier Spring Final",
      "bestOf": "bo3",
      "time": "18:00",
      "isLive": false,
      "matchId": "12346",
      "logo1": "https://...",
      "logo2": "https://..."
    }
  ]
}
```

## ⚡ Performance

- **Cache Duration**: 5 dakika
- **Request Timeout**: 30 saniye
- **Puppeteer Optimization**: Render için optimize edilmiş

## 🛠️ Technologies

- **Node.js**: Server runtime
- **Express**: Web framework
- **Puppeteer**: Web scraping
- **Cheerio**: HTML parsing
- **CORS**: Cross-origin resource sharing

## 📝 Notes

- API, HLTV.org'dan veri çekmek için Puppeteer kullanır
- Render'da çalışması için özel Puppeteer konfigürasyonu yapılmıştır
- Cache sistemi ile performans optimize edilmiştir
- Error handling ve logging geliştirilmiştir

## 🔗 Mobile App Integration

Mobil uygulamada bu API'yi kullanmak için:

```typescript
const HLTV_API_BASE = 'https://your-render-app.onrender.com';

// Maçları al
const response = await fetch(`${HLTV_API_BASE}/hltv/basic`);
const data = await response.json();
``` 