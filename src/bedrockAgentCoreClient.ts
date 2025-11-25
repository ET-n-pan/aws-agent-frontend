// src/bedrockAgentCoreClient.ts
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";

// ⚠️ You MUST provide a browser-safe credential provider here.
// E.g. from Cognito Identity Pool, Amplify Auth, or a backend-signed call.
// For now this is just a placeholder.
const client = new BedrockAgentCoreClient({
  region: "us-west-2",
  credentials: async () => {
    // TODO: replace with Cognito / Web Identity / Amplify
    throw new Error("Configure browser credentials here");
  },
});

function makeRuntimeSessionId(): string {
  // 33+ chars, deterministic per tab/session if you want
  return "web-" + crypto.randomUUID() + "-session";
}

// You can keep a session ID per browser tab for multi-turn chat.
let runtimeSessionId = makeRuntimeSessionId();

export async function invokeAgentCore(inputText: string): Promise<string> {
  const payloadBytes = new TextEncoder().encode(inputText);

  const cmd = new InvokeAgentRuntimeCommand({
    runtimeSessionId, // reuse this to keep context
    agentRuntimeArn:
      "arn:aws:bedrock-agentcore:us-west-2:454953018734:runtime/hosted_agent_e83vr-GB6hCT5CfM",
    qualifier: "DEFAULT", // or your alias
    payload: payloadBytes,
  });

  const resp = await client.send(cmd);
  // response.response is a streaming blob; transformToString works in browser too.
  const text = await resp.response.transformToString();
  return text;
}

// Optionally expose this if you want to reset the conversation
export function resetSession() {
  runtimeSessionId = makeRuntimeSessionId();
}
