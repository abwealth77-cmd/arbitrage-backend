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
const BANKROLL = 100; // Adjust as needed

const BOOK_SCORE = {
  pinnacle: 1.0,
  bet365: 0.97,
  "1xbet": 0.92,
  betking: 0.95,
  msport: 0.95,
  betwinner: 0.95,
  sportybet: 0.95,
  bet9ja: 0.95,
  paripesa: 0.95
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
    ? new Date(match.commence_time) - new Date() > 10 * 60 * 1000
    : true;
}

function logTrade(trade, file = "./arb_logs.json") {
  let logs = [];
  if (fs.existsSync(file)) logs = JSON.parse(fs.readFileSync(file));
  logs.push(trade);
  fs.writeFileSync(file, JSON.stringify(logs, null, 2));
}

async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text
      })
    });
    const data = await res.json();
    console.log("Telegram response:", data);
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

function getSignalLevel(profit, score) {
  if (profit > 5 && score > 25) return "HIGH";
  if (profit > 2 && score > 15) return "MEDIUM";
  return "LOW";
}

// -------------------- TEST ARB ENGINE --------------------
// Generates fake arbitrage trades for testing
async function runTestArbEngine() {
  if (isRunning) return [];
  isRunning = true;
  lastRunTime = Date.now();

  try {
    console.log("🚀 TEST ARB ENGINE RUNNING...");

    // Fake sports
    const sports = ["soccer_test_league"];

    const results = [];
    let allocatedBankroll = 0;
    const MAX_EXPOSURE = BANKROLL * 0.4;

    for (const sport of sports) {
      // Generate 5 fake matches
      for (let i = 1; i <= 5; i++) {
        const profit = Math.random() * 10; // 0% to 10%
        const score = Math.floor(Math.random() * 50);
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
          match: `Team${i} vs Team${i + 1}`,
          sport,
          profit: profit.toFixed(2) + "%",
          score,
          signal,
          stake: stake.toFixed(2),
          bankroll: BANKROLL.toFixed(2),
          odds: { Team1: 2 + Math.random(), Team2: 2 + Math.random(), Draw: 3 + Math.random() },
          timestamp: new Date().toISOString()
        };

        logTrade(trade, "./test_arb_logs.json");

        if (signal === "MEDIUM" || signal === "HIGH") {
          await sendTelegramMessage(
            `🏦 TEST ARB SIGNAL ${signal}\n` +
            `${trade.match}\n` +
            `Sport: ${sport}\n` +
            `Profit: ${trade.profit}\n` +
            `Score: ${trade.score}\n` +
            `Stake: $${trade.stake}\n` +
            `Bankroll: $${trade.bankroll}`
          );
        }

        results.push(trade);
      }
    }

    console.log(`✅ Test trades generated: ${results.length}`);
    console.table(results.map(t => ({
      Match: t.match,
      Profit: t.profit,
      Signal: t.signal,
      Stake: t.stake
    })));

    failureCount = 0;
    return results;

  } catch (err) {
    failureCount++;
    console.error("❌ TEST ARB ENGINE ERROR:", err.message);
    return [];
  } finally {
    isRunning = false;
  }
}

// -------------------- EXPRESS ROUTES --------------------
app.get("/", (req, res) => {
  res.json({ success: true, message: "Arbitrage backend is running 🚀" });
});

app.get("/arbs", async (req, res) => {
  // Here we can switch to live ARB later
  const results = await runTestArbEngine();
  res.json({ success: true, count: results.length, data: results });
});

app.get("/test-alert", async (req, res) => {
  await sendTelegramMessage("🔥 TEST ALERT: Arb bot is working");
  res.json({ success: true });
});

app.get("/test-key", (req, res) => {
  res.json({ keyExists: !!API_KEY });
});

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
