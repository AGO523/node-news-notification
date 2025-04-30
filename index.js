const { PubSub } = require("@google-cloud/pubsub");

async function pullMessages() {
  const topic = process.env.PUBSUB_TOPIC;
  const subName = `${topic}-sub`;

  const pubsub = new PubSub();
  const subscription = pubsub.subscription(subName);

  console.log(`Pulling messages from ${subName}...`);

  const [messages] = await subscription.pull({
    maxMessages: 10,
    returnImmediately: true,
  });

  if (!messages.length) {
    console.log("No messages found.");
    return;
  }

  for (const msg of messages) {
    console.log(`Message ID: ${msg.id}`);
    console.log(`Data: ${msg.data.toString()}`);
    if (msg.attributes) {
      console.log(`Attributes: ${JSON.stringify(msg.attributes)}`);
    }
  }

  const ackIds = messages.map((msg) => msg.ackId);
  await subscription.acknowledge(ackIds);
  console.log("Acknowledged all messages.");
}

pullMessages().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
