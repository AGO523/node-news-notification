import express from "express";

const app = express();
const port = process.env.PORT || 8080;

// JSON ボディをパース
app.use(express.json());

// POST /publish に対応
app.post("/publish", (req, res) => {
  console.log("Received request body:", req.body);
  res.status(200).send("Message received and logged.");
});

// ヘルスチェック対応（任意）
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
