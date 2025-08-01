const puppeteer = require("puppeteer");
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function scrapeHLTV() {
  let browser;
  try {
    console.log('🔄 Starting HLTV scraping...');
    const startTime = Date.now();
    
    // Configure Puppeteer for Render
    const launchOptions = {
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    };
    
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to HLTV
    await page.goto("https://www.hltv.org/matches", { 
      waitUntil: "networkidle2",
      timeout: 30000 
    });
    
    // Wait for matches to load
    await page.waitForSelector(".match", { timeout: 15000 });

    const data = await page.evaluate(() => {
      const matches = Array.from(document.querySelectorAll(".match")).filter(
        (el) => !el.closest(".match .match") // iç içe olanları alma
      );

      const liveMatches = [];
      const upcomingMatches = [];

      matches.forEach((match) => {
        const isLive = !!match.querySelector(".match-meta-live");

        const linkPath = match.querySelector("a")?.getAttribute("href") ?? "";
        const fullLink = linkPath ? "https://www.hltv.org" + linkPath : null;

        const event =
          match.querySelector(".match-event .text-ellipsis")?.textContent?.trim() || "Unknown";

        // Improved BO parsing to handle cases like "BObo3"
        let bo = "unknown";
        const matchMetaElements = Array.from(match.querySelectorAll(".match-meta"));
        
        for (const el of matchMetaElements) {
          const text = el.textContent.trim().toLowerCase();
          if (text.includes("bo")) {
            // Extract the BO format (e.g., "bo3", "bo5", "bo1")
            const boMatch = text.match(/bo(\d+)/);
            if (boMatch) {
              bo = `bo${boMatch[1]}`;
              break;
            } else if (text.includes("bo")) {
              // Fallback: if we find "bo" but can't extract number, use "bo3" as default
              bo = "bo3";
              break;
            }
          }
        }

        const teamNames = Array.from(match.querySelectorAll(".match-teamname")).map((el) =>
          el?.textContent?.trim()
        );

        const teamLogos = Array.from(match.querySelectorAll(".match-team-logo")).map((img) =>
          img?.getAttribute("src")
        );

        const mapsWon = Array.from(match.querySelectorAll(".map-score span")).map((el) =>
          el?.textContent?.trim()
        );

        // Zaman bilgisini HLTV'de görünen şekilde çek
        let time = match.querySelector(".matchTime")?.textContent?.trim();
        if (!time) {
          time = match.querySelector(".match-info-row .time")?.textContent?.trim();
        }
        // Eğer hala yoksa, data-unix'ten HLTV'nin gösterdiği gibi üret
        if (!time) {
          const unix = match.querySelector("[data-unix]")?.getAttribute("data-unix");
          if (unix) {
            const date = new Date(Number(unix));
            // HLTV'nin gösterdiği gibi: "14 Jul, 18:00"
            const day = String(date.getDate()).padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[date.getMonth()];
            const hour = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            time = `${day} ${month}, ${hour}:${min}`;
          }
        }
        if (!time) time = null;

        // Canlı yayın (stream) linkini çek
        let stream = null;
        // HLTV'de genellikle .stream-box a veya benzeri bir yerde olur
        const streamLink = match.querySelector('.stream-box a')?.getAttribute('href');
        if (streamLink) {
          // HLTV'de genellikle tam link değil, /external?url=... ile başlar, tam link üret
          if (streamLink.startsWith('/external?url=')) {
            const urlParam = new URLSearchParams(streamLink.split('?')[1]);
            stream = decodeURIComponent(urlParam.get('url'));
          } else if (streamLink.startsWith('http')) {
            stream = streamLink;
          } else {
            stream = 'https://www.hltv.org' + streamLink;
          }
        }

        // Minimum kontrol
        const team1 = teamNames[0] ?? null;
        const team2 = teamNames[1] ?? null;
        const logo1 = teamLogos[0] ?? null;
        const logo2 = teamLogos[1] ?? null;

        if (!team1 || !team2) return; // takımlar yoksa bu maçı atla

        // Extract match ID from the link path
        let matchId = null;
        if (linkPath) {
          const matchIdMatch = linkPath.match(/\/matches\/(\d+)/);
          matchId = matchIdMatch ? matchIdMatch[1] : null;
        }

        if (isLive) {
          liveMatches.push({
            team1,
            team2,
            logo1,
            logo2,
            event,
            bestOf: bo,
            mapScore: `${mapsWon[0] ?? "?"} - ${mapsWon[1] ?? "?"}`,
            link: fullLink, // Maç detay sayfası linki
            streamUrl: matchId ? `https://www.hltv.org/live?matchId=${matchId}` : stream, // Yayın linki
            matchId,
            time,
            stream,
            isLive: true,
          });
        } else {
          upcomingMatches.push({
            team1,
            team2,
            logo1,
            logo2,
            event,
            bestOf: bo,
            time,
            link: fullLink, // Maç detay sayfası linki
            streamUrl: stream, // Yayın linki (varsa)
            matchId,
            stream,
            isLive: false,
          });
        }
      });

      return { liveMatches, upcomingMatches };
    });

    await browser.close();
    
    console.log(`✅ HLTV scraping completed in ${Date.now() - startTime}ms`);
    console.log(`📊 Found ${data.liveMatches.length} live matches and ${data.upcomingMatches.length} upcoming matches`);
    
    return data;
  } catch (error) {
    console.error('❌ HLTV scraping error:', error);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

// Express endpoint
app.get("/hltv", async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'matches';
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('✅ Serving matches from cache');
      res.json(cached.data);
      return;
    }
    
    const data = await scrapeHLTV();
    
    // Add matchId and isLive properties to each match
    if (data.liveMatches) {
      data.liveMatches.forEach(match => {
        if (match.link) {
          const matchIdMatch = match.link.match(/\/matches\/(\d+)/);
          match.matchId = matchIdMatch ? matchIdMatch[1] : null;
          
          // Add streamUrl for live matches
          if (match.matchId && !match.streamUrl) {
            match.streamUrl = `https://www.hltv.org/live?matchId=${match.matchId}`;
          }
        }
        match.isLive = true;
      });
    }
    
    if (data.upcomingMatches) {
      data.upcomingMatches.forEach(match => {
        if (match.link) {
          const matchIdMatch = match.link.match(/\/matches\/(\d+)/);
          match.matchId = matchIdMatch ? matchIdMatch[1] : null;
        }
        match.isLive = false;
      });
    }
    
    // Cache the result
    cache.set(cacheKey, { data, timestamp: Date.now() });
    
    res.json(data);
  } catch (err) {
    console.error('❌ HLTV endpoint error:', err);
    res.status(500).json({ 
      error: 'HLTV verileri alınamadı',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Basic endpoint for mobile app
app.get("/hltv/basic", async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'matches_basic';
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('✅ Serving basic matches from cache');
      res.json(cached.data);
      return;
    }
    
    const data = await scrapeHLTV();
    
    // Add streamUrl for live matches
    if (data.liveMatches) {
      data.liveMatches.forEach(match => {
        if (match.matchId && !match.streamUrl) {
          match.streamUrl = `https://www.hltv.org/live?matchId=${match.matchId}`;
        }
      });
    }
    
    // Cache the result
    cache.set(cacheKey, { data, timestamp: Date.now() });
    
    res.json(data);
  } catch (err) {
    console.error('❌ HLTV basic endpoint error:', err);
    res.status(500).json({ 
      error: 'HLTV verileri alınamadı',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get streams for specific match by ID
app.get("/hltv/streams/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchUrl = `https://www.hltv.org/matches/${matchId}`;
    
    // For now, return a simple response with HLTV Live stream
    res.json({
      matchId,
      matchUrl,
      streams: [
        {
          platform: 'hltv',
          url: `https://www.hltv.org/live?matchId=${matchId}`,
          language: 'HLTV Live',
          name: 'HLTV Live'
        }
      ],
      liveUrl: `https://www.hltv.org/live?matchId=${matchId}`
    });
  } catch (err) {
    console.error('❌ HLTV streams endpoint error:', err);
    res.status(500).json({ 
      error: 'Stream bilgileri alınamadı',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get match details with streams by ID
app.get("/hltv/match/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchUrl = `https://www.hltv.org/matches/${matchId}`;
    
    // Get basic match info
    const allMatches = await scrapeHLTV();
    const match = [...allMatches.liveMatches, ...allMatches.upcomingMatches]
      .find(m => m.link && m.link.includes(matchId));
    
    const matchData = {
      matchId,
      matchUrl,
      liveUrl: `https://www.hltv.org/live?matchId=${matchId}`,
      ...match,
      streams: [
        {
          platform: 'hltv',
          url: `https://www.hltv.org/live?matchId=${matchId}`,
          language: 'HLTV Live',
          name: 'HLTV Live'
        }
      ]
    };
    
    res.json(matchData);
  } catch (err) {
    console.error('❌ HLTV match details endpoint error:', err);
    res.status(500).json({ 
      error: 'Maç detayları alınamadı',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'HLTV API',
    timestamp: new Date().toISOString(),
    endpoints: {
      '/hltv': 'Basic match data',
      '/hltv/basic': 'Match data with matchId and isLive',
      '/hltv/streams/:matchId': 'Get streams for specific match',
      '/hltv/match/:matchId': 'Get match details with streams',
      '/health': 'Health check'
    }
  });
});

// Clear cache endpoint
app.post("/clear-cache", (req, res) => {
  cache.clear();
  res.json({ 
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HLTV scraper API running on http://localhost:${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   GET /hltv - Basic match data`);
  console.log(`   GET /hltv/basic - Match data with matchId and isLive`);
  console.log(`   GET /hltv/streams/:matchId - Get streams for specific match`);
  console.log(`   GET /hltv/match/:matchId - Get match details with streams`);
  console.log(`   GET /health - Health check`);
  console.log(`   POST /clear-cache - Clear cache`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down HLTV API server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down HLTV API server...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
