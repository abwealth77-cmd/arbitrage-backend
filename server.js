import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

function getMockMatches() {
  return [
    {
      match: "Team A vs Team B",
      oddsA: 2.1,
      oddsB: 2.2,
      bookmakerA: "Bookie1",
      bookmakerB: "Bookie2"
    }
  ];
}

function detectArb(matches, stake = 10000) {
  const results = [];

  matches.forEach((m) => {
    const invA = 1 / m.oddsA;
    const invB = 1 / m.oddsB;
    const sum = invA + invB;

    if (sum < 1) {
      const returnAmount = stake / sum;
      const profit = returnAmount - stake;

      results.push({
        ...m,
        sum,
        profit,
        stakeA: (invA / sum) * stake,
        stakeB: (invB / sum) * stake
      });
    }
  });

  return results;
}

app.get("/arbs", (req, res) => {
  const matches = getMockMatches();
  const arbs = detectArb(matches);

  res.json({
    success: true,
    count: arbs.length,
    data: arbs
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Arbitrage engine running" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Arbitrage backend running on port", PORT);
});
