
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
app.get("/sports", async (req, res) => {
  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/?apiKey=${API_KEY}`
  );

  const data = await response.json();
  res.json(data);
});
// -------------------- ARBITRAGE ROUTE --------------------
app.get("/arbs", async (req, res) => {
  try {
    const sports = [
      "soccer_brazil_serie_b",
      "soccer_chile_campeonato",
      "soccer_conmebol_copa_libertadores",
      "soccer_conmebol_copa_sudamericana",
      "soccer_japan_j_league",
      "soccer_norway_eliteserien",
      "soccer_spain_segunda_division"
    ];

    let results = [];

    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&bookmakers=bet365,pinnacle,1xbet`;

      const response = await fetch(url);
      const data = await response.json();

      if (!Array.isArray(data)) continue;

      data.forEach(match => {
        if (!match.home_team || !match.away_team) return;

        const books = match.bookmakers;
        if (!books) return;

        let best = {};

        // STEP 1: get best odds per outcome
        books.forEach(b => {
          b.markets?.[0]?.outcomes?.forEach(o => {
            if (!best[o.name] || o.price > best[o.name]) {
              best[o.name] = o.price;
            }
          });
        });

        const odds = Object.values(best);
        if (odds.length < 2) return;

        // STEP 2: arb formula
        const totalImplied = odds.reduce((sum, o) => sum + (1 / o), 0);
        const profit = ((1 / totalImplied) - 1) * 100;

        // 🚨 STRICT FILTER (IMPORTANT)
        if (profit <= 0.5) return; // ignore weak & negative edges

        const status =
          profit >= 1.5
            ? "🔥 STRONG ARBITRAGE"
            : "⚡ VALID ARBITRAGE";

        // Telegram ONLY real arbs
        sendTelegramMessage(
          `🚨 ARBITRAGE ALERT\n\n` +
          `${match.home_team} vs ${match.away_team}\n` +
          `Profit: ${profit.toFixed(2)}%\n` +
          `Status: ${status}`
        );

        results.push({
          match: `${match.home_team} vs ${match.away_team}`,
          sport,
          profit: profit.toFixed(2) + "%",
          status,
          odds: best
        });
      });
    }

    return res.json({
      success: true,
      count: results.length,
      data: results.sort((a, b) =>
        parseFloat(b.profit) - parseFloat(a.profit)
      )
    });

  } catch (err) {
    console.error("ARB ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
