import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 8080;
const geminiApiKey = process.env.GEMINI_API_KEY;

app.use(express.json());

app.post("/publish", async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages)) {
    return res.status(400).send("Invalid request");
  }

  for (const message of messages) {
    try {
      const decoded = Buffer.from(message.data, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);

      console.log("Decoded message:", parsed);

      const summary = await runGemini(parsed.topic);
      console.log("Gemini summary:", summary);
    } catch (err) {
      console.error("Error handling message:", err);
    }
  }

  res.status(200).send("Messages processed.");
});

async function runGemini(topic) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
「${topic}」について、信頼性の高いニュースソースを3件検索して要約してください。
それぞれのニュースについて簡潔な要約と参照URLを必ず記載してください。
`;

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
