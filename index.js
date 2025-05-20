import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 8080;
const geminiApiKey = process.env.GEMINI_API_KEY;
const allowedRepositories = process.env.ALLOWED_REPOSITORIES
  ? process.env.ALLOWED_REPOSITORIES.split(",")
  : [];

const D1_API_URL = process.env.D1_API_URL;
const D1_API_KEY = process.env.D1_API_KEY;
const D1_API_TOKEN = process.env.D1_API_TOKEN;

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

      await saveToD1({
        email: parsedMessage.email,
        uuid: parsedMessage.uuid,
        repositoryName: parsedMessage.repositoryName,
        topic: parsedMessage.topic,
        summary,
        createdAt: new Date().toISOString(),
      });
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

async function saveToD1({
  email,
  uuid,
  repositoryName,
  topic,
  summary,
  createdAt,
}) {
  if (!D1_API_URL || !D1_API_TOKEN) {
    throw new Error("D1 API credentials not set");
  }

  const sql = `
    INSERT INTO summaries (email, uuid, repository_name, topic, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const body = {
    params: [email, uuid, repositoryName, topic, summary, createdAt],
    sql,
  };

  const response = await fetch(D1_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${D1_API_TOKEN}`,
      ...(D1_API_KEY && { "X-API-KEY": D1_API_KEY }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Failed to insert into D1:", errText);
    throw new Error("D1 insert failed");
  }

  console.log("D1 insert success");
}

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
