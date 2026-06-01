
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());



const API_KEY = process.env.ODDS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const fs = require("fs");

const BOOK_SCORE = {
  pinnacle: 1.0,
  bet365: 0.97,
  "1xbet": 0.92
};
let isRunning = false;
let lastRunTime = 0;
let failureCount = 0;
function calculateScore(profit, bookCount) {
  return (profit * 10) + (bookCount * 2);
}
function isFresh(match) {
  return match?.commence_time
    ? (new Date(match.commence_time) - new Date()) > 10 * 60 * 1000
    : true;
}
function calculateStake(profit, bankroll = 100) {
  const edge = profit / 100;
  const kelly = edge / 2; // half-kelly (safer institutional version)

  return Math.max(1, bankroll * kelly);
}
function logTrade(trade) {
  const file = "./arb_logs.json";

  let logs = [];
  if (fs.existsSync(file)) {
    logs = JSON.parse(fs.readFileSync(file));
  }

  logs.push(trade);

  fs.writeFileSync(file, JSON.stringify(logs, null, 2));
}
async function runArbEngine() {
  if (isRunning) return; // prevents overlap

  isRunning = true;
  lastRunTime = Date.now();

  try {
    console.log("🚀 ARB ENGINE RUNNING...");

    // CALL YOUR EXISTING LOGIC HERE
    await runArbLogic();

    failureCount = 0; // reset on success

  } catch (err) {
    failureCount++;
    console.log("❌ ARB ENGINE ERROR:", err.message);

  } finally {
    isRunning = false;
  }
}
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
        if (!isFresh(match)) return;

        const books = match.bookmakers;
        if (!books) return;

        let best = {};
        let bookCount = 0;

        books.forEach(b => {
          const weight = BOOK_SCORE[b.key] || 0.9;
          bookCount++;

          b.markets?.[0]?.outcomes?.forEach(o => {
            const weighted = o.price * weight;

            if (!best[o.name] || weighted > best[o.name]) {
              best[o.name] = weighted;
            }
          });
        });

        const odds = Object.values(best);
        const labels = Object.keys(best);

        if (odds.length !== 3) return;

        const totalImplied = odds.reduce((s, o) => s + (1 / o), 0);
        const profit = ((1 / totalImplied) - 1) * 100;

        if (profit < 1.0) return; // institutional threshold

        const score = calculateScore(profit, bookCount);
        const stake = calculateStake(profit);

        const trade = {
          match: `${match.home_team} vs ${match.away_team}`,
          sport,
          profit: profit.toFixed(2) + "%",
          score,
          stake: stake.toFixed(2),
          odds: best,
          timestamp: new Date().toISOString()
        };

        logTrade(trade);

        if (score > 15) {
          sendTelegramMessage(
            `🏦 INSTITUTIONAL ARB\n\n` +
            `${trade.match}\n` +
            `Profit: ${trade.profit}\n` +
            `Score: ${trade.score}\n` +
            `Stake: $${trade.stake}`
          );
        }

        results.push(trade);
      });
    }

    return res.json({
      success: true,
      count: results.length,
      data: results.sort((a, b) => b.score - a.score)
    });

  } catch (err) {
    console.error("INSTITUTIONAL ERROR:", err);
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
setInterval(async () => {
  try {
    await fetch("http://localhost:" + PORT + "/arbs");
  } catch (e) {
    console.log("Auto-run error:", e.message);
  }
}, 60 * 1000); // every 60 seconds
