const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

let lastSentArbKey = null;

/* =========================
   MOCK FUNCTIONS (REPLACE LATER)
========================= */
async function getLiveMatches() {
  return [];
}

async function sendTelegram(message) {
  console.log("Telegram:", message);
}

/* =========================
   ARBITRAGE ENGINE
========================= */
function detectArb(matches, stake = 10000) {
  const results = [];

  matches.forEach((m) => {
    if (!m.oddsA || !m.oddsB) return;

    const invA = 1 / m.oddsA;
    const invB = 1 / m.oddsB;
    const sum = invA + invB;

    if (sum < 1) {
      const returnAmount = stake / sum;
      const profit = returnAmount - stake;
      const profitPercent = (profit / stake) * 100;

      results.push({
        ...m,
        sum,
        profit,
        profitPercent,
        stakeA: (invA / sum) * stake,
        stakeB: (invB / sum) * stake
      });
    }
  });

  return results.sort((a, b) => b.profitPercent - a.profitPercent);
}

/* =========================
   SCANNER (NO DUPLICATES)
========================= */
async function runScanner() {
  try {
    const matches = await getLiveMatches();
    const arbs = detectArb(matches);

    if (!arbs.length) {
      return setTimeout(runScanner, 5000);
    }

    const best = arbs[0];

    const arbKey = `${best.match}-${best.oddsA}-${best.oddsB}`;

    if (arbKey !== lastSentArbKey) {
      lastSentArbKey = arbKey;

      await sendTelegram(
`🔥 ARBITRAGE ALERT

Match: ${best.match}

💰 Profit: ${best.profitPercent.toFixed(2)}%
💵 Stake A: ${best.stakeA.toFixed(0)}
💵 Stake B: ${best.stakeB.toFixed(0)}

Bookmakers:
${best.bookmakerA} vs ${best.bookmakerB}`
      );
    }

  } catch (err) {
    console.log("Scanner error:", err.message);
  }

  setTimeout(runScanner, 5000);
}

/* START SCANNER */
runScanner();

/* ROUTES */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.get("/arbs", async (req, res) => {
  const matches = await getLiveMatches();
  const arbs = detectArb(matches);

  res.json({
    success: true,
    count: arbs.length,
    data: arbs
  });
});

/* START SERVER */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
