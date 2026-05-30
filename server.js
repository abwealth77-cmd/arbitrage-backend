const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
const API_KEY = process.env.ODDS_API_KEY;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Arbitrage backend is running 🚀"
  });
});

app.get("/arbs", async (req, res) => {
  try {
    const url =
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h`;

    const response = await fetch(url);
    const data = await response.json();

    const results = [];

    data.forEach(match => {
      const books = match.bookmakers;

      if (!books || books.length < 2) return;

      const b1 = books[0];
      const b2 = books[1];

      const o1 = b1.markets[0].outcomes[0].price;
      const o2 = b2.markets[0].outcomes[0].price;

      const implied = (1 / o1) + (1 / o2);

      if (implied < 1) {
        results.push({
          match: `${match.home_team} vs ${match.away_team}`,
          bookmakerA: b1.title,
          bookmakerB: b2.title,
          oddsA: o1,
          oddsB: o2,
          profit: ((1 - implied) * 100).toFixed(2) + "%"
        });
      }
    });

    res.json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "API error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
