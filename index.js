import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 8080;
const geminiApiKey = process.env.GEMINI_API_KEY;
const allowedRepositories = ["newsAppReactRouter"];

app.use(express.json());

app.post("/publish", async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages)) {
    return res.status(400).send("Invalid request");
  }

  for (const message of messages) {
    try {
      const decoded = Buffer.from(message.data, "base64").toString("utf8");
      const parsedMessage = JSON.parse(decoded);

      if (!allowedRepositories.includes(parsedMessage.repositoryName)) {
        return res.status(403).send("Forbidden");
      }

      console.log("Decoded message:", parsedMessage);

      const summary = await runGemini(parsedMessage.prompt);
      console.log("Gemini summary:", summary);
      // summary を専用の D1 に保存
      // cron trigger で定期的に実行する workers を作成
    } catch (err) {
      console.error("Error handling message:", err);
    }
  }

  res.status(200).send("Messages processed.");
});

async function runGemini(prompt) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
