import { type Message, createXcmAgent, xcm } from "@sodazone/ocelloids-client";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";

const LOG_FILE = "xcm-messages.json";

// Initialize log file with empty array if it doesn't exist
async function initializeLogFile() {
  if (!existsSync(LOG_FILE)) {
    await writeFile(LOG_FILE, JSON.stringify([], null, 2), "utf-8");
    console.log(`Initialized log file: ${LOG_FILE}`);
  }
}

// Append message to JSON log file
async function logToFile(msg: Message<xcm.XcmMessagePayload>) {
  try {
    let messages: Message<xcm.XcmMessagePayload>[] = [];
    
    // Read existing messages if file exists
    if (existsSync(LOG_FILE)) {
      const content = await readFile(LOG_FILE, "utf-8");
      messages = JSON.parse(content);
    }
    
    // Add timestamp to message for easier tracking
    const messageWithTimestamp = {
      ...msg,
      loggedAt: new Date().toISOString(),
    };
    
    // Append new message
    messages.push(messageWithTimestamp);
    
    // Write back to file
    await writeFile(LOG_FILE, JSON.stringify(messages, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to log file:", error);
  }
}

function handleMessage(msg: Message<xcm.XcmMessagePayload>) {
  // In an UI, it could be useful to filter by extrinsic hash
  // if (
  //   msg.payload.origin.extrinsicHash === "0x"
  // ) {
  // handle cases for each step of the XCM journey
  if (xcm.isXcmSent(msg)) {
    console.log("SENT", msg.payload.waypoint);
  } else if (xcm.isXcmRelayed(msg)) {
    console.log("RELAYED", msg.payload.waypoint);
  } else if (xcm.isXcmHop(msg)) {
    console.log("HOP", msg.payload.direction, msg.payload.waypoint);
  } else if (xcm.isXcmReceived(msg)) {
    console.log("RECEIVED", msg.payload.waypoint);
  } else if (xcm.isXcmTimeout(msg)) {
    console.log(
      "TIMEOUT",
      msg.payload.origin.chainId,
      msg.payload.destination.chainId,
    );
  } else {
    console.log(msg.payload.type, msg.payload.waypoint);
  }
  // }
}

async function main() {
  const agent = createXcmAgent({
    httpUrl: process.env.OC_HTTP_URL,
    wsUrl: process.env.OC_WS_URL,
    apiKey: process.env.OC_API_KEY,
  });

  // Initialize log file
  await initializeLogFile();

  // Check health
  console.log(await agent.health());

  // Subscribe on-demand
  const ws = await agent.subscribe(
    {
      origins: "*",
      destinations: "*",
      senders: [
        "5DPLGAR43FRbPxkkAWJudfyLTbJAP1GMvtyt1mx7KCuiuNvK"
      ],
      events: "*",
    },
    // Stream handlers
    {
      onMessage: async (msg) => {
        handleMessage(msg);
        await logToFile(msg);
      },
      onAuthError: console.error,
      onError: console.error,
      onClose: (error) => console.error(error.reason),
    },
    // On-demand subscription handlers (optional)
    {
      onSubscriptionError: console.error,
      onSubscriptionCreated: console.log,
      onError: console.error,
    },
  );

  // Close and exit after 5 minutes
  // Subscription will be automatically removed
  setTimeout(async () => {
    console.log("Closing websocket and exiting...");
    console.log(`Messages logged to: ${LOG_FILE}`);
    ws.close();
    process.exit();
  }, 300_000);
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
