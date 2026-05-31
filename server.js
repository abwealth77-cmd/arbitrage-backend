const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.ODDS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text
      })
    });
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}
// -------------------- HOME ROUTE --------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Arbitrage backend is running 🚀"
  });
});

// -------------------- TEST KEY --------------------
app.get("/test-key", (req, res) => {
  res.json({
    keyExists: !!API_KEY
  });
});

// -------------------- ARBITRAGE ROUTE --------------------
app.get("/arbs", async (req, res) => {
  try {
    const sports = [
  // Europe top leagues
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",

  // Scandinavia (your focus)
  "soccer_norway_eliteserien",
  "soccer_norway_obos_ligaen",
  "soccer_sweden_allsvenskan",
  "soccer_sweden_superettan",
  "soccer_denmark_superliga",
  "soccer_denmark_1st_div",

  // Finland
  "soccer_finland_veikkausliiga",

  // Australia
  "soccer_australia_aleague",
  "soccer_australia_npl",

  // Americas
  "soccer_usa_mls",
  "soccer_mexico_liga_mx",
  "soccer_brazil_serie_a",
  "soccer_brazil_serie_b",
  "soccer_argentina_primera_division",

  // Extra Europe depth
  "soccer_portugal_primeira_liga",
  "soccer_netherlands_eredivisie",
  "soccer_turkey_super_league",
  "soccer_belgium_first_division_a"
];

    let results = [];

    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&bookmakers=bet365,pinnacle,1xbet`;

      const response = await fetch(url);
      const data = await response.json();

      if (!Array.isArray(data)) continue;

      data.forEach(match => {
        const books = match.bookmakers;
        if (!books || books.length < 2) return;

        let best = {};

        books.forEach(b => {
          b.markets?.[0]?.outcomes?.forEach(o => {
            if (!best[o.name] || o.price > best[o.name]) {
              best[o.name] = o.price;
            }
          });
        });

        const odds = Object.values(best);
        if (odds.length < 2) return;

        const implied = odds.reduce((sum, o) => sum + (1 / o), 0);
        const profit = (1 - implied) * 100;

        if (profit > -8) {

          if (profit > 0) {
            const message =
              "🔥 ARBITRAGE ALERT\n\n" +
              match.home_team + " vs " + match.away_team + "\n" +
              "Profit: " + profit.toFixed(2) + "%";

            sendTelegramMessage(message);
          }

          results.push({
            match: `${match.home_team} vs ${match.away_team}`,
            sport,
            profit: profit.toFixed(2) + "%",
            status: profit > 0 ? "ARBITRAGE" : "NEAR ARB",
            odds: best
          });

        }

      });
    }

    res.json({
      success: true,
      count: results.length,
      data: results.sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
