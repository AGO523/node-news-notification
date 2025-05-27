import express from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 8080;
const geminiApiKey = process.env.GEMINI_API_KEY;
const allowedOwner = process.env.ALLOWED_OWNER || "";
const allowedRepositories = process.env.ALLOWED_REPOSITORIES
  ? process.env.ALLOWED_REPOSITORIES.split(",").map(
      (repo) => `${allowedOwner}/${repo}`
    )
  : [];

const D1_API_URL = process.env.D1_API_URL;
const D1_API_KEY = process.env.D1_API_KEY;
const D1_API_TOKEN = process.env.D1_API_TOKEN;

const shortTermLimiter = rateLimit({
  windowMs: 1 * 10 * 1000, // 10秒
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests in a short time. Please slow down.",
});

const longTermLimiter = rateLimit({
  windowMs: 60 * 10 * 1000, // 10分
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests this minute. Please try again later.",
});

app.use(express.json());

app.post("/publish", shortTermLimiter, longTermLimiter, async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages)) {
    return res.status(400).send("Invalid request");
  }

  try {
    for (const message of messages) {
      const decoded = Buffer.from(message.data, "base64").toString("utf8");
      const parsedMessage = JSON.parse(decoded);
      const formatedRepositoryName = `${process.env.ALLOWED_OWNER}/${parsedMessage.repositoryName}`;

      if (!allowedRepositories.includes(formatedRepositoryName)) {
        console.warn("Repository not allowed:", parsedMessage.repositoryName);
        continue;
      }

      // saveToD1 だけ先に await で逐次実行
      await saveToD1({
        email: parsedMessage.email,
        uuid: parsedMessage.uuid,
        repositoryName: parsedMessage.repositoryName,
        topic: parsedMessage.topic,
        summary: null,
        status: "accepted",
        createdAt: Math.floor(Date.now() / 1000),
      });

      // Gemini + update はバックグラウンドで非同期
      (async () => {
        try {
          const summary = await runGemini(parsedMessage.prompt);
          await updateSummaryInD1(parsedMessage.uuid, summary);
        } catch (err) {
          console.error("Background processing failed:", err);
        }
      })();
    }

    // saveToD1 完了後にレスポンス
    res.status(200).send("Messages received.");
  } catch (err) {
    console.error("Initial processing error:", err);
    res.status(500).send("Internal server error");
  }
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
  status,
  createdAt,
}) {
  if (!D1_API_URL || !D1_API_TOKEN) {
    throw new Error("D1 API credentials not set");
  }

  const sql = `
    INSERT INTO summaries (
      email, uuid, repository_name, topic, summary, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const body = {
    sql,
    params: [email, uuid, repositoryName, topic, summary, status, createdAt],
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
    console.error("D1 insert failed:", errText);
    throw new Error("D1 insert failed");
  }

  console.log("D1 insert success");
}

async function updateSummaryInD1(uuid, summary) {
  if (!D1_API_URL || !D1_API_TOKEN) {
    throw new Error("D1 API credentials not set");
  }

  const sql = `
    UPDATE summaries
    SET summary = ?, status = 'pending'
    WHERE uuid = ?
  `;

  const body = {
    sql,
    params: [summary, uuid],
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
    console.error("D1 update failed:", errText);
    throw new Error("D1 update failed");
  }

  console.log("D1 update success");
}

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
