// src/agentcore/client.ts
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { fetchAuthSession } from "aws-amplify/auth";
import outputs from "../../amplify_outputs.json";
import { createRuntimeSessionId } from "./session";

// Adjust these depending on your amplify_outputs.json structure
const AUTH_REGION = outputs.auth?.aws_region ?? "ap-northeast-1";
const IDENTITY_POOL_ID = outputs.auth?.aws_cognito_identity_pool_id;
const USER_POOL_ID = outputs.auth?.aws_user_pools_id;

// AgentCore runtime settings
const AGENTCORE_REGION = "us-west-2"; // where AgentCore runtime lives
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
    clientConfig: {
      region: AUTH_REGION,
    },
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

/**
 * Canonical non-streaming helper.
 * This matches the official JS example:
 *   const textResponse = await response.response.transformToString();
 */
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

  // **This** is what AWS docs show and is known to work
  const text = await response.response.transformToString();

  return { text, runtimeSessionId: sessionId };
}

export type StreamCallbacks = {
  runtimeSessionId?: string;
  /**
   * Called for each line of output.
   */
  onTextChunk?: (chunk: string) => void;
  /**
   * Called per line for higher-level inspection (e.g. future tool-call parsing).
   */
  onEvent?: (evt: any) => void;
};

/**
 * "Streaming" helper built on top of invokeAgentRuntime.
 * It waits for the full response, then emits it line-by-line,
 * which is enough for:
 *   - updating UI incrementally
 *   - isolating tool-related lines later
 */
export async function streamAgentRuntime(
  prompt: string,
  opts: StreamCallbacks = {}
): Promise<{ fullText: string; runtimeSessionId: string }> {
  const { runtimeSessionId, onTextChunk, onEvent } = opts;

  // Get the full text using the known-good call
  const { text, runtimeSessionId: newSessionId } = await invokeAgentRuntime(
    prompt,
    runtimeSessionId
  );

  // Split by lines (preserve newlines in chunks)
  const lines = text.split(/\r?\n/);
  let fullText = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chunk = i < lines.length - 1 ? line + "\n" : line; // last line no extra \n
    fullText += chunk;

    onTextChunk?.(chunk);
    onEvent?.({
      type: "line",
      line,
      index: i,
    });
  }

  return { fullText, runtimeSessionId: newSessionId };
}
