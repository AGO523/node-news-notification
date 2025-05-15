import express from "express";

const app = express();
const port = process.env.PORT || 8080;

// JSON ボディをパース
app.use(express.json());

// POST /publish に対応
app.post("/publish", (req, res) => {
  const messages = req.body?.messages;

  if (!Array.isArray(messages)) {
    console.error("Invalid request: messages field is missing or not an array");
    return res.status(400).send("Invalid request");
  }

  for (const message of messages) {
    try {
      const decoded = Buffer.from(message.data, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      console.log("Decoded message:", parsed);
    } catch (err) {
      console.error("Failed to decode or parse message:", err);
    }
  }

  res.status(200).send("Messages received and decoded.");
});

// ヘルスチェック対応（任意）
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
