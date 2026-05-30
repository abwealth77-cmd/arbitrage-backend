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

app.get("/arbs", (req, res) => {
  res.json({
    success: true,
    data: [
      {
        match: "Team A vs Team B",
        bookmakerA: "Bet365",
        bookmakerB: "1xBet",
        oddsA: 2.1,
        oddsB: 2.05,
        profit: "2.3%"
      }
    ]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
