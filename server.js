const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- CONFIG --------------------
const API_KEY = process.env.ODDS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BANKROLL = 100;

// Include more bookmakers (small + big)
const BOOK_SCORE = {
  pinnacle: 1.0,
  bet365: 0.97,
  "1xbet": 0.92,
  betking: 0.95,
  msport: 0.95,
  betwinner: 0.95,
  sportybet: 0.95,
  bet9ja: 0.95,
  paripesa: 0.95,
  betonline: 0.9,
  comeon: 0.9,
  "10bet": 0.9
};


// -------------------- GLOBALS --------------------
let isRunning = false;
let lastRunTime = 0;
let failureCount = 0;

// -------------------- UTILS --------------------
function calculateScore(profit, bookCount) {
  return profit * 10 + bookCount * 2;
}

function isFresh(match) {
  return match?.commence_time
    ? new Date(match.commence_time) - new Date() > 5 * 60 * 1000
    : true;
}

function logTrade(trade) {
  const file = "./arb_logs.json";
  let logs = [];
  if (fs.existsSync(file)) logs = JSON.parse(fs.readFileSync(file));
  logs.push(trade);
  fs.writeFileSync(file, JSON.stringify(logs, null, 2));
}

async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text
        })
      }
    );
    const data = await res.json();
    console.log("Telegram response:", data);
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

function getSignalLevel(profit, score) {
  if (profit > 3 && score > 20) return "HIGH";
  if (profit > 1 && score > 10) return "MEDIUM";
  return "LOW";
}

// -------------------- ARB ENGINE --------------------
async function runArbEngine() {
  if (isRunning) return [];
  isRunning = true;
  lastRunTime = Date.now();

  try {
    console.log("🚀 ARB ENGINE RUNNING...");

    const sports = [
      "soccer_brazil_serie_b",
      "soccer_denmark_superliga",
      "soccer_sweden_allsvenskan",
      "soccer_norway_eliteserien",
      "soccer_japan_j_league",
      "soccer_portugal_primeira_liga",
      "soccer_netherlands_eredivisie"
    ];

    let results = [];
    let allocatedBankroll = 0;
    const MAX_EXPOSURE = BANKROLL * 0.4;

    for (const sport of sports) {
      // include multiple markets
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h,spreads,totals&bookmakers=${Object.keys(BOOK_SCORE).join(",")}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      for (const match of data) {
        if (!match.home_team || !match.away_team) continue;
        if (!isFresh(match)) continue;

        const books = match.bookmakers;
        if (!books) continue;

        let best = {};
        let bookCount = 0;
        for (const b of books) {
          const weight = BOOK_SCORE[b.key] || 0.9;
          bookCount++;
          b.markets?.forEach(market =>
            market.outcomes?.forEach(o => {
              const weighted = o.price * weight;
              if (!best[o.name] || weighted > best[o.name]) best[o.name] = weighted;
            })
          );
        }

        const odds = Object.values(best);
        if (odds.length < 2) continue; // need at least two outcomes

        const totalImplied = odds.reduce((s, o) => s + 1 / o, 0);
        const profit = ((1 / totalImplied) - 1) * 100;

        const score = calculateScore(profit, bookCount);
        const signal = getSignalLevel(profit, score);

        let stakeFraction = 0.02;
        if (signal === "MEDIUM") stakeFraction = 0.05;
        if (signal === "HIGH") stakeFraction = 0.1;

        let stake = BANKROLL * stakeFraction;
        if (allocatedBankroll + stake > MAX_EXPOSURE) {
          stake = Math.max(1, MAX_EXPOSURE - allocatedBankroll);
        }
        allocatedBankroll += stake;

        const trade = {
          match: `${match.home_team} vs ${match.away_team}`,
          sport,
          profit: profit.toFixed(2) + "%",
          score,
          signal,
          stake: stake.toFixed(2),
          bankroll: BANKROLL.toFixed(2),
          odds: best,
          timestamp: new Date().toISOString()
        };

        logTrade(trade);

        // Send Telegram for MEDIUM/HIGH only
        if (signal === "MEDIUM" || signal === "HIGH") {
          await sendTelegramMessage(
            `🏦 ARB SIGNAL ${signal}\n` +
            `${trade.match}\n` +
            `Sport: ${sport}\n` +
            `Profit: ${trade.profit}\n` +
            `Score: ${trade.score}\n` +
            `Stake: $${trade.stake}\n` +
            `Bankroll: $${trade.bankroll}`
          );
        }

        results.push(trade);
        if (allocatedBankroll >= MAX_EXPOSURE) break;
      }
    }

    // Show all matches in console temporarily
    console.log("📊 ARB ENGINE RESULTS:");
    console.table(results.map(t => ({
      Match: t.match,
      Sport: t.sport,
      Profit: t.profit,
      Score: t.score,
      Signal: t.signal,
      Stake: t.stake
    })));

    console.log(`✅ Total allocated bankroll: $${allocatedBankroll.toFixed(2)}`);
    failureCount = 0;
    return results;

  } catch (err) {
    failureCount++;
    console.error("❌ ARB ENGINE ERROR:", err.message);
    return [];
  } finally {
    isRunning = false;
  }
}

// -------------------- EXPRESS ROUTES --------------------
app.get("/", (req, res) => res.json({ success: true, message: "Arbitrage backend is running 🚀" }));

app.get("/arbs", async (req, res) => {
  const results = await runArbEngine();
  res.json({ success: true, count: results.length, data: results });
});

app.get("/test-alert", async (req, res) => {
  await sendTelegramMessage("🔥 TEST ALERT: Arb bot is working");
  res.json({ success: true });
});

app.get("/test-key", (req, res) => res.json({ keyExists: !!API_KEY }));

// -------------------- SCHEDULER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  startScheduler();
});

function startScheduler() {
  const interval = 30 * 1000; // every 30 seconds
  setInterval(async () => {
    console.log("⏱ Running scheduled arb engine...");
    await runArbEngine();
  }, interval);
}
