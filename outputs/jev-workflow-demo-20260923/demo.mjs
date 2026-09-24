import { readFile } from "node:fs/promises";
import { handle } from "./workflow.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixture.json", import.meta.url), "utf8"));
const live = process.argv.includes("--live");
const apiKey = process.env.TYPESAFE_API_KEY;
if (live && !apiKey) throw new Error("--live requires TYPESAFE_API_KEY");

let mockIndex = 0;
const ctx = {
  async request({ method, url, credential_ref: credentialRef, body }) {
    if (method !== "POST" || url !== "https://api.typesafe.ai/v1/systemone" || credentialRef !== "typesafe") {
      throw new Error("Unexpected decision request");
    }
    if (live) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return { status: response.status, body: await response.json() };
    }

    const mock = fixture.mock_jev[mockIndex++];
    if (!mock) throw new Error("Mock Jev responses exhausted");
    const offered = Object.keys(body.questions.next_step.criteria);
    if (!offered.includes(mock.action)) throw new Error(`Mock action ${mock.action} was not offered`);
    const rest = (1 - mock.probability) / Math.max(offered.length - 1, 1);
    const probabilities = Object.fromEntries(
      offered.map((name) => [name, name === mock.action ? mock.probability : rest])
    );
    return {
      status: 200,
      body: {
        model: "jev-1.13.0",
        answers: {
          next_step: {
            type: "choice",
            choice: mock.action,
            confidence: mock.confidence,
            probabilities
          },
          enough_evidence: { type: "noul", noul: mock.sufficient }
        }
      }
    };
  }
};

const result = await handle(fixture.trigger, ctx);
console.log(JSON.stringify({ mode: live ? "live_jev" : "mock_jev", ...result }, null, 2));
