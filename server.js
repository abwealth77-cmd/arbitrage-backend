
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

    const BOOK_WEIGHT = {
      pinnacle: 1.0,
      bet365: 0.98,
      "1xbet": 0.95
    };

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

        // STEP 1: weighted best odds (IMPORTANT UPGRADE)
        books.forEach(b => {
          const weight = BOOK_WEIGHT[b.key] || 0.9;

          b.markets?.[0]?.outcomes?.forEach(o => {
            const weightedPrice = o.price * weight;

            if (!best[o.name] || weightedPrice > best[o.name]) {
              best[o.name] = weightedPrice;
            }
          });
        });

        const odds = Object.values(best);
        const labels = Object.keys(best);

        if (odds.length !== 3) return; // enforce TRUE 3-way market

        // STEP 2: true arbitrage formula
        const totalImplied = odds.reduce((sum, o) => sum + (1 / o), 0);
        const profit = ((1 / totalImplied) - 1) * 100;

        // STEP 3: strict filtering (PRO LEVEL)
        if (profit < 0.8) return;

        // STEP 4: stake calculator (VERY IMPORTANT)
        const bankroll = 100; // you can change later
        const stakes = {};

        labels.forEach(label => {
          stakes[label] = ((bankroll / best[label]) / totalImplied).toFixed(2);
        });

        const status =
          profit >= 2
            ? "🔥 HIGH VALUE ARB"
            : "⚡ VALID ARB";

        // STEP 5: Telegram alert (clean + actionable)
        sendTelegramMessage(
          `🚨 PRO ARBITRAGE ALERT 🚨\n\n` +
          `${match.home_team} vs ${match.away_team}\n` +
          `Profit: ${profit.toFixed(2)}%\n\n` +
          `📊 STAKES (₦100 example):\n` +
          `${labels.map(l => `${l}: ${stakes[l]}`).join("\n")}\n\n` +
          `Status: ${status}`
        );

        results.push({
          match: `${match.home_team} vs ${match.away_team}`,
          sport,
          profit: profit.toFixed(2) + "%",
          status,
          odds: best,
          stakes
        });
      });
    }

    return res.json({
      success: true,
      count: results.length,
      data: results.sort(
        (a, b) => parseFloat(b.profit) - parseFloat(a.profit)
      )
    });

  } catch (err) {
    console.error("PRO ARB ERROR:", err);
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
