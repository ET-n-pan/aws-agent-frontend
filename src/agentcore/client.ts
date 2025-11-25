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

  if (!idToken) throw new Error("No ID token – user is not authenticated.");
  if (!IDENTITY_POOL_ID) throw new Error("Identity Pool ID missing.");
  if (!USER_POOL_ID) throw new Error("User Pool ID missing.");

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

// Non-streaming (keep if you still want it)
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
// Streaming: plain text chunks (no SSE)
// ─────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "data"; text: string }
  | { type: "done" };

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

  // We don't trust contentType anymore – we'll just stream whatever it gives
  const stream = response.response as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      // This may be partial sentences, JSON, whatever AgentCore sends
      yield { type: "data", text: chunk };
    }
  }

  // flush any remaining
  const final = decoder.decode();
  if (final) {
    yield { type: "data", text: final };
  }

  yield { type: "done" };
}
