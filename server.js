async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML" // optional but useful
      })
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("Telegram error:", data);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Network/Telegram failure:", error);
    return false;
  }
}
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
setInterval(async () => {
  try {
    const matches = await getLiveMatches();
    const arbs = detectArb(matches);

    if (arbs && arbs.length > 0) {
      const best = arbs[0];

      await sendTelegram(
`🔥 AUTO ARBITRAGE ALERT!

Match: ${best.match}

💰 Profit: ${(best.profitPercent || 0).toFixed(2)}%
💵 Stake A: ${best.stakeA.toFixed(0)}
💵 Stake B: ${best.stakeB.toFixed(0)}

Bookmakers:
${best.bookmakerA} vs ${best.bookmakerB}`
      );
    }

  } catch (err) {
    console.log("Auto scanner error:", err.message);
  }
}, 15000);
let lastSentMatch = null;

async function getLiveMatches() {
  const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?regions=eu&markets=h2h&apiKey=${process.env.API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  const matches = [];

  data.forEach((event) => {
    if (!event.bookmakers || event.bookmakers.length < 2) return;

    try {
      const b1 = event.bookmakers[0];
      const b2 = event.bookmakers[1];

      const oddsA = b1.markets[0].outcomes[0].price;
      const oddsB = b2.markets[0].outcomes[1].price;

      matches.push({
        match: `${event.home_team} vs ${event.away_team}`,
        oddsA,
        oddsB,
        bookmakerA: b1.title,
        bookmakerB: b2.title
      });
    } catch (e) {}
  });

  return matches;
}

function detectArb(matches, stake = 10000) {
  const results = [];

  matches.forEach((m) => {

    // 🧼 FILTER INVALID ODDS
    if (
      !m.oddsA || !m.oddsB ||
      m.oddsA < 1.3 || m.oddsB < 1.3 ||
      m.oddsA > 5 || m.oddsB > 5
    ) {
      return;
    }

    const invA = 1 / m.oddsA;
    const invB = 1 / m.oddsB;
    const sum = invA + invB;

    if (sum < 1) {
      const returnAmount = stake / sum;
      const profit = returnAmount - stake;
      const profitPercent = (profit / stake) * 100;

      // 🧼 FILTER FAKE ARBS
      if (profitPercent < 0.3 || profitPercent > 8) {
        return;
      }

      results.push({
        ...m,
        sum,
        profit: Number(profit.toFixed(2)),
        profitPercent: Number(profitPercent.toFixed(2)),
        stakeA: (invA / sum) * stake,
        stakeB: (invB / sum) * stake
      });
    }
  });

  return results.sort((a, b) => b.profitPercent - a.profitPercent);
}
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});
app.get("/arbs", async (req, res) => {
  try {
    const matches = await getLiveMatches();

    // SAFE CHECK 1
    if (!Array.isArray(matches)) {
      return res.json({
        success: false,
        message: "getLiveMatches did not return array",
        data: []
      });
    }

    const arbs = detectArb(matches);

    // SAFE CHECK 2
    if (!Array.isArray(arbs) || arbs.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const best = arbs[0];

    await sendTelegram(
`🔥 ARBITRAGE FOUND!

Match: ${best.match}

💰 Profit: ${(best.profitPercent || 0).toFixed(2)}%
💵 Stake A: ${(best.stakeA || 0).toFixed(0)}
💵 Stake B: ${(best.stakeB || 0).toFixed(0)}

Bookmakers:
${best.bookmakerA} vs ${best.bookmakerB}`
    );

    res.json({
      success: true,
      count: arbs.length,
      data: arbs
    });

  } catch (error) {
    console.error("ARBS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Arbitrage engine running" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Arbitrage backend running on port", PORT);
});
