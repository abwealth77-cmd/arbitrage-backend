// -------------------- IMPORTS --------------------
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- CONFIG --------------------
const BANKROLL = 100; // Adjust as needed
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// -------------------- BOOK SCORE --------------------
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
  betano: 0.95,
  betway: 0.95
};

// -------------------- GLOBALS --------------------
let isRunning = false;
let lastRunTime = 0;

// -------------------- UTILS --------------------
function calculateScore(profit, bookCount) {
  return (profit * 10) + (bookCount * 2);
}

function isFresh(match) {
  return match?.commence_time
    ? (new Date(match.commence_time) - new Date()) > 10 * 60 * 1000
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
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
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

// -------------------- FETCHERS --------------------
async function fetchSportyBet() {
  try {
    const res = await fetch("https://www.sportybet.com/api/odd-endpoint");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "sportybet", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("SportyBet fetch error:", err.message); return []; }
}

async function fetchBet9ja() {
  try {
    const res = await fetch("https://sports.bet9ja.com/api/odd-endpoint");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "bet9ja", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("Bet9ja fetch error:", err.message); return []; }
}

async function fetchParipesa() {
  try {
    const res = await fetch("https://paripesa.ng/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home_team,
      away_team: match.away_team,
      bookmakers: [{ key: "paripesa", markets: [{ outcomes: [
        { name: match.home_team, price: match.odds.home },
        { name: match.away_team, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("Paripesa fetch error:", err.message); return []; }
}

async function fetchMSport() {
  try {
    const res = await fetch("https://www.msport.com/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "msport", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("MSport fetch error:", err.message); return []; }
}

async function fetchBetKing() {
  try {
    const res = await fetch("https://www.betking.com/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "betking", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("BetKing fetch error:", err.message); return []; }
}

async function fetchBetano() {
  try {
    const res = await fetch("https://www.betano.ng/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "betano", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("Betano fetch error:", err.message); return []; }
}

async function fetch1xBet() {
  try {
    const res = await fetch("https://www.1xbet.ng/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "1xbet", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("1xBet fetch error:", err.message); return []; }
}

async function fetchBetway() {
  try {
    const res = await fetch("https://www.betway.com.ng/api/odds");
    const data = await res.json();
    return data.map(match => ({
      home_team: match.home,
      away_team: match.away,
      bookmakers: [{ key: "betway", markets: [{ outcomes: [
        { name: match.home, price: match.odds.home },
        { name: match.away, price: match.odds.away },
        { name: "Draw", price: match.odds.draw }
      ]}]}]
    }));
  } catch (err) { console.error("Betway fetch error:", err.message); return []; }
}

async function fetchAllBookies() {
  const results = await Promise.all([
    fetchSportyBet(),
    fetchBet9ja(),
    fetchParipesa(),
    fetchMSport(),
    fetchBetKing(),
    fetchBetano(),
    fetch1xBet(),
    fetchBetway()
  ]);
  return results.flat();
}

// -------------------- ARB ENGINE --------------------
async function runArbEngine() {
  if (isRunning) return [];
  isRunning = true;

  try {
    console.log("🚀 ARB ENGINE RUNNING...");
    const sports = [
      "soccer_brazil_serie_b",
      "soccer_japan_j_league",
      "soccer_norway_eliteserien",
      "soccer_spain_segunda_division",
      "soccer_portugal_primeira_liga",
      "soccer_netherlands_eredivisie",
    
      "soccer_turkey_super_lig",
      "soccer_mexico_liga_mx",
      "soccer_usa_mls",
      "soccer_argentina_primera_division",
      "soccer_denmark_superliga",
      "soccer_sweden_allsvenskan"
    ];

    let results = [];
    let allocatedBankroll = 0;
    const MAX_EXPOSURE = BANKROLL * 0.4;

    for (const sport of sports) {
      const matches = await fetchAllBookies();
      if (!Array.isArray(matches) || matches.length === 0) continue;

      for (const match of matches) {
        if (!match.home_team || !match.away_team) continue;
        if (!isFresh(match)) continue;

        const books = match.bookmakers || [];
        let best = {};
        let bookCount = 0;

        for (const b of books) {
          const weight = BOOK_SCORE[b.key] || 0.9;
          bookCount++;
          b.markets?.[0]?.outcomes?.forEach(o => {
            const weighted = o.price * weight;
            if (!best[o.name] || weighted > best[o.name]) best[o.name] = weighted;
          });
        }

        const odds = Object.values(best);
        if (odds.length !== 3) continue; // Only 1X2 markets

        const totalImplied = odds.reduce((s, o) => s + 1 / o, 0);
        const profit = ((1 / totalImplied) - 1) * 100;
        if (profit <= 0) continue;

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

    console.log(`✅ Total allocated bankroll: $${allocatedBankroll.toFixed(2)}`);
    return results;
  } catch (err) {
    console.error("❌ ARB ENGINE ERROR:", err.message);
    return [];
  } finally {
    isRunning = false;
  }
}

// -------------------- EXPRESS ROUTES --------------------
app.get("/", (req, res) => res.json({ success: true, message: "Arbitrage backend is running 🚀" }));

app.get("/arbs", async (req, res) => {
  const trades = await runArbEngine();
  res.json({ success: true, count: trades.length, data: trades });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Arbitrage server running on port ${PORT}`));
