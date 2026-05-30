const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.ODDS_API_KEY;

// 🟢 HOME ROUTE
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Arbitrage backend is running 🚀"
  });
});

// 🟡 CHECK API KEY
app.get("/test-key", (req, res) => {
  res.json({
    keyExists: !!API_KEY
  });
});

// 🔵 ARBITRAGE ROUTE (SAFE VERSION)
app.get("/arbs", async (req, res) => {
  try {
    const sports = [
      "soccer_epl",
      "soccer_spain_la_liga",
      "soccer_italy_serie_a",
      "soccer_germany_bundesliga",
      "soccer_france_ligue_one",
      "soccer_brazil_serie_a",
      "soccer_usa_mls",
      "soccer_argentina_primera_division"
    ];

    let alerts = [];

    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&bookmakers=bet365,pinnacle,1xbet`;

      const response = await fetch(url);
      const data = await response.json();

      if (!Array.isArray(data)) continue;

      data.forEach(match => {
        const books = match.bookmakers;
        if (!books || books.length < 2) return;

        let bestOdds = {};

        books.forEach(b => {
          b.markets[0].outcomes.forEach(o => {
            if (!bestOdds[o.name] || o.price > bestOdds[o.name]) {
              bestOdds[o.name] = o.price;
            }
          });
        });

        const odds = Object.values(bestOdds);
        if (odds.length < 2) return;

        const implied = odds.reduce((sum, o) => sum + (1 / o), 0);
        const profit = (1 - implied) * 100;

        if (profit > 0) {
          alerts.push({
            match: `${match.home_team} vs ${match.away_team}`,
            sport,
            profit: profit.toFixed(2) + "%",
            odds: bestOdds
          });
        }
      });
    }

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

  

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
