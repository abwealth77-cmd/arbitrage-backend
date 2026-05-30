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
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Missing API key"
      });
    }

    const url = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h`;

    const response = await fetch(url);
    const data = await response.json();

    res.json({
      success: true,
      count: data.length,
      data: data.slice(0, 5)
    });

  } catch (err) {
    console.error("ERROR:", err);

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
