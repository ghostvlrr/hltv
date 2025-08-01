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

async function scrapeHLTV() {
  const browser = await puppeteer.launch({ headless: "new" });
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

      // Extract match ID from the link path
      let matchId = null;
      if (linkPath) {
        const matchIdMatch = linkPath.match(/\/matches\/(\d+)/);
        matchId = matchIdMatch ? matchIdMatch[1] : null;
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
          mapScore: `${mapsWon[0] ?? "?"} - ${mapsWon[1] ?? "?"}`,
          link: fullLink,
          streamUrl: matchId ? `https://www.hltv.org/live?matchId=${matchId}` : stream,
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
          link: fullLink,
          streamUrl: matchId ? `https://www.hltv.org/live?matchId=${matchId}` : stream,
          matchId,
          stream,
          isLive: false,
        });
      }
    });

    return { liveMatches, upcomingMatches };
  });

  await browser.close();
  return data;
}

// Express endpoint
app.get("/hltv", async (req, res) => {
  try {
    const data = await scrapeHLTV();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`HLTV scraper API running on http://localhost:${PORT}`);
});
