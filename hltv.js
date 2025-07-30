const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeHLTV() {
  const browser = await puppeteer.launch({ headless: true });
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
          mapScore: `${mapsWon[0] ?? "?"} - ${mapsWon[1] ?? "?"}`,
          link: fullLink,
          time,
          stream,
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
          stream,
        });
      }
    });

    return { liveMatches, upcomingMatches };
  });

  // --- EK: Canlı maçlar için eksik alanları detaydan çek ---
  for (let match of data.liveMatches) {
    if (!match.stream || !match.time || match.event === "Unknown") {
      if (!match.link) continue;
      try {
        const detailPage = await browser.newPage();
        await detailPage.goto(match.link, { waitUntil: "domcontentloaded" });
        // Stream
        if (!match.stream) {
          const streamUrl = await detailPage.evaluate(() => {
            const btn = document.querySelector('.match-streams-btn-external');
            return btn ? btn.getAttribute('href') : null;
          });
          if (streamUrl) {
            if (streamUrl.startsWith('/external?url=')) {
              const urlParam = new URLSearchParams(streamUrl.split('?')[1]);
              match.stream = decodeURIComponent(urlParam.get('url'));
            } else if (streamUrl.startsWith('http')) {
              match.stream = streamUrl;
            } else {
              match.stream = 'https://www.hltv.org' + streamUrl;
            }
          }
        }
        // Time
        if (!match.time) {
          const detailTime = await detailPage.evaluate(() => {
            // HLTV maç detayında genellikle .date veya [data-unix] olur
            const dateEl = document.querySelector('.date') || document.querySelector('[data-unix]');
            if (dateEl) {
              if (dateEl.getAttribute('data-unix')) {
                const unix = dateEl.getAttribute('data-unix');
                const date = new Date(Number(unix));
                const day = String(date.getDate()).padStart(2, '0');
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const month = monthNames[date.getMonth()];
                const hour = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                return `${day} ${month}, ${hour}:${min}`;
              } else if (dateEl.textContent) {
                return dateEl.textContent.trim();
              }
            }
            return null;
          });
          if (detailTime) match.time = detailTime;
        }
        // Event
        if (match.event === "Unknown") {
          const detailEvent = await detailPage.evaluate(() => {
            // HLTV maç detayında genellikle .event-logo[title] veya .event-logo altındaki img alt text
            const eventLogo = document.querySelector('.event-logo');
            if (eventLogo) {
              if (eventLogo.getAttribute('title')) return eventLogo.getAttribute('title');
              const img = eventLogo.querySelector('img');
              if (img && img.getAttribute('alt')) return img.getAttribute('alt');
            }
            // Alternatif: başlıkta veya başka bir yerde
            const eventName = document.querySelector('.event .text-ellipsis');
            if (eventName) return eventName.textContent.trim();
            return null;
          });
          if (detailEvent) match.event = detailEvent;
        }
        await detailPage.close();
      } catch (err) {
        // Hata olursa devam et
        continue;
      }
    }
  }

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
