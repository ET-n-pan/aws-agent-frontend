// src/agentcore/client.ts
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { fetchAuthSession } from "aws-amplify/auth";
import outputs from "../../amplify_outputs.json";
import { createRuntimeSessionId } from "./session";

const AUTH_REGION = outputs.auth?.aws_region ?? "ap-northeast-1";
const IDENTITY_POOL_ID = outputs.auth?.aws_cognito_identity_pool_id;
const USER_POOL_ID = outputs.auth?.aws_user_pools_id;

const AGENTCORE_REGION = "us-west-2";
const AGENT_RUNTIME_ARN =
  "arn:aws:bedrock-agentcore:us-west-2:454953018734:runtime/hosted_agent_e83vr-GB6hCT5CfM";

async function getAwsCredentials() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("No ID token – user is not authenticated.");
  }
  if (!IDENTITY_POOL_ID) {
    throw new Error("Identity Pool ID not found in amplify_outputs.json.");
  }
  if (!USER_POOL_ID) {
    throw new Error("User Pool ID not found in amplify_outputs.json.");
  }

  const credentials = fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    clientConfig: { region: AUTH_REGION },
    logins: {
      [`cognito-idp.${AUTH_REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken,
    },
  });

  return credentials;
}

async function getAgentCoreClient() {
  const credentials = await getAwsCredentials();
  return new BedrockAgentCoreClient({
    region: AGENTCORE_REGION,
    credentials,
  });
}

// ─────────────────────────────────────────
// Non-streaming helper (what we had before)
// ─────────────────────────────────────────
export async function invokeAgentRuntime(
  prompt: string,
  runtimeSessionId?: string
): Promise<{ text: string; runtimeSessionId: string }> {
  const client = await getAgentCoreClient();
  const sessionId = runtimeSessionId ?? createRuntimeSessionId();

  const payloadBytes = new TextEncoder().encode(JSON.stringify({ prompt }));

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENT_RUNTIME_ARN,
    runtimeSessionId: sessionId,
    qualifier: "DEFAULT",
    payload: payloadBytes,
  });

  const response = await client.send(command);
  const text = await response.response.transformToString();

  return { text, runtimeSessionId: sessionId };
}

// ─────────────────────────────────────────
// Streaming helper — JS equivalent of Python example
// ─────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "data"; text: string }
  | { type: "done" }
  | { type: "raw-json"; json: any };

export async function* streamAgentRuntime(
  prompt: string,
  runtimeSessionId?: string
): AsyncGenerator<AgentStreamEvent> {
  const client = await getAgentCoreClient();
  const sessionId = runtimeSessionId ?? createRuntimeSessionId();

  const payloadBytes = new TextEncoder().encode(JSON.stringify({ prompt }));

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENT_RUNTIME_ARN,
    runtimeSessionId: sessionId,
    qualifier: "DEFAULT",
    payload: payloadBytes,
  });

  const response = await client.send(command);

  const contentType = response.contentType ?? "";

  // Case 1: streaming "text/event-stream" like in the Python example
  if (contentType.includes("text/event-stream")) {
    const stream = response.response as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split into lines; keep last partial line in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        // SSE-style: "data: { ... }"
        if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.slice(5).trimStart(); // remove "data:" + space
          // You can keep it as raw text, or try JSON.parse here:
          yield { type: "data", text: dataStr };
        }
      }
    }

    // Flush any remaining buffered text (if it's a valid data line)
    const finalLine = buffer.trim();
    if (finalLine.startsWith("data:")) {
      const dataStr = finalLine.slice(5).trimStart();
      yield { type: "data", text: dataStr };
    }

    yield { type: "done" };
    return;
  }

  // Case 2: standard JSON response (application/json) like in Python example
  if (contentType === "application/json") {
    const text = await response.response.transformToString();
    try {
      const json = JSON.parse(text);
      yield { type: "raw-json", json };
    } catch {
      yield { type: "data", text };
    }
    yield { type: "done" };
    return;
  }

  // Fallback: just treat whole body as raw text
  const text = await response.response.transformToString();
  yield { type: "data", text };
  yield { type: "done" };
}
