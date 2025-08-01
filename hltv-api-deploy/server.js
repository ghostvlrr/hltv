const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'EsportsPulse API is running!',
    endpoints: {
      '/live-matches': 'Get live Valorant matches from VLR.gg',
      '/hltv-matches': 'Get live CS:GO matches from HLTV.org'
    }
  });
});

// Yardımcı: Maç detay sayfasından oynanan haritayı çek
async function fetchCurrentMap(matchPageUrl) {
  try {
    const resp = await axios.get(matchPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(resp.data);
    // Harita adı: ilk .map > div > span
    const mapName = $('.map > div > span').first().text().trim();
    return mapName || null;
  } catch (err) {
    return null;
  }
}

// Maç detay sayfasından stream linkini çek
async function fetchStreamUrl(matchPageUrl) {
  try {
    const resp = await axios.get(matchPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(resp.data);
    // En güncel stream butonu: .match-streams-btn-external_
    const streamBtn = $('.match-streams-btn-external').first();
    const streamUrl = streamBtn.attr('href') || null;
    return streamUrl;
  } catch (err) {
    return null;
  }
}

// Helper function to extract "best of" information from match data
const extractBestOfInfo = (match) => {
  // Check various possible fields where "best of" information might be stored
  const possibleFields = [
    match.best_of,
    match.bo,
    match.format,
    match.series,
    match.match_series,
    match.event_series
  ];
  
  for (const field of possibleFields) {
    if (field) {
      const fieldStr = field.toString().toLowerCase();
      
      // Handle cases like "BObo3" - extract just the number part
      if (fieldStr.includes('bobo')) {
        const boMatch = fieldStr.match(/bobo(\d+)/);
        if (boMatch) {
          return boMatch[1]; // Return just the number, not "bo" prefix
        }
      }
      
      // Look for patterns like "bo3", "bo5", "best of 3", "best of 5", etc.
      if (fieldStr.includes('bo3') || fieldStr.includes('best of 3')) {
        return '3';
      }
      if (fieldStr.includes('bo5') || fieldStr.includes('best of 5')) {
        return '5';
      }
      if (fieldStr.includes('bo1') || fieldStr.includes('best of 1')) {
        return '1';
      }
      if (fieldStr.includes('bo')) {
        // Extract the number after "bo"
        const boMatch = fieldStr.match(/bo(\d+)/);
        if (boMatch) {
          return boMatch[1]; // Return just the number, not "bo" prefix
        }
      }
    }
  }
  
  // Default to "3" for Valorant matches if no specific information is found
  return '3';
};

// VLR.gg Live Matches Endpoint
app.get('/live-matches', async (req, res) => {
  try {
    const url = 'https://www.vlr.gg/';
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(resp.data);

    const result = [];
    const liveMatchPromises = [];
    
    $('.js-home-matches-upcoming a.wf-module-item').each((i, el) => {
      const isLive = $(el).find('.h-match-eta.mod-live').length > 0;
      if (isLive) {
        const teams = [];
        const flags = [];
        const scores = [];
        
        $(el).find('.h-match-team').each((j, team) => {
          teams.push($(team).find('.h-match-team-name').text().trim());
          const flagClass = $(team).find('.flag').attr('class') || '';
          flags.push(flagClass.replace(' mod-', '').replace('16', '_'));
          scores.push($(team).find('.h-match-team-score').text().trim());
        });

        const eta = 'LIVE';
        const match_event = $(el).find('.h-match-preview-event').text().trim();
        const match_series = $(el).find('.h-match-preview-series').text().trim();
        const timestamp = $(el).find('.moment-tz-convert').attr('data-utc-ts');
        const url_path = 'https://www.vlr.gg/' + $(el).attr('href');

        // Her maç için detaydan harita ve stream bilgisini çek
        liveMatchPromises.push(
          Promise.all([
            fetchCurrentMap(url_path),
            fetchStreamUrl(url_path)
          ]).then(([current_map, stream_url]) => {
            const matchData = {
              team1: teams[0],
              team2: teams[1],
              flag1: flags[0],
              flag2: flags[1],
              score1: scores[0],
              score2: scores[1],
              time_until_match: eta,
              match_series,
              match_event,
              unix_timestamp: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
              match_page: url_path,
              current_map,
              stream_url
            };
            
            // Extract "best of" information
            matchData.best_of = extractBestOfInfo(matchData);
            
            return matchData;
          })
        );
      }
    });

    const liveMatches = await Promise.all(liveMatchPromises);
    result.push(...liveMatches);

    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error fetching live matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live matches',
      message: error.message
    });
  }
});

// HLTV.org Live Matches Endpoint
app.get('/hltv-matches', async (req, res) => {
  try {
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    await page.goto("https://www.hltv.org/matches", { waitUntil: "networkidle2" });
    await page.waitForSelector(".match");

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

        const bo =
          Array.from(match.querySelectorAll(".match-meta"))
            .map((el) => el.textContent.trim().toLowerCase())
            .find((txt) => txt.includes("bo")) ?? "unknown";

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

        if (isLive) {
          liveMatches.push({
            team1,
            team2,
            logo1,
            logo2,
            event,
            bestOf: bo,
            mapsWon,
            time,
            stream,
            matchUrl: fullLink
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
            stream,
            matchUrl: fullLink
          });
        }
      });

      return { liveMatches, upcomingMatches };
    });

    await browser.close();

    res.json({
      success: true,
      data: {
        live: data.liveMatches,
        upcoming: data.upcomingMatches
      },
      counts: {
        live: data.liveMatches.length,
        upcoming: data.upcomingMatches.length
      }
    });
  } catch (error) {
    console.error('Error fetching HLTV matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HLTV matches',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: ['/', '/live-matches', '/hltv-matches']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 EsportsPulse API server running on port ${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   - GET / (health check)`);
  console.log(`   - GET /live-matches (Valorant matches)`);
  console.log(`   - GET /hltv-matches (CS:GO matches)`);
}); 