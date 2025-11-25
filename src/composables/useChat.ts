// src/composables/useChat.ts
import { ref, computed } from "vue";
import { streamAgentRuntime } from "../agentcore/client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function useChat() {
  const messages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  const lastError = ref<string | null>(null);
  let runtimeSessionId: string | null = null;

  async function sendMessage(input: string) {
    const text = input.trim();
    if (!text) return;

    // User message
    messages.value.push({ role: "user", content: text });

    // Placeholder assistant message to stream into
    const assistantIndex = messages.value.push({
      role: "assistant",
      content: "",
    }) - 1;

    isGenerating.value = true;
    lastError.value = null;

    try {
      const { fullText, runtimeSessionId: newSessionId } =
        await streamAgentRuntime(text, {
          runtimeSessionId: runtimeSessionId ?? undefined,
          onTextChunk(chunk) {
            // append each line as it "streams"
            messages.value[assistantIndex].content += chunk;
          },
          onEvent(evt) {
            // Hook for later: inspect evt.line to isolate tool calls etc.
            // console.debug("Line event:", evt);
          },
        });

      runtimeSessionId = newSessionId;

      // Ensure message content equals accumulated text
      messages.value[assistantIndex].content = fullText;
    } catch (e: any) {
      console.error(e);
      lastError.value = e?.message ?? String(e);
      messages.value[assistantIndex].content =
        `Error while calling AgentCore: ${lastError.value}`;
    } finally {
      isGenerating.value = false;
    }
  }

  // Extract latest ```yaml ... ``` block from assistant messages
  const lastTemplate = computed<string | null>(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i];
      if (msg.role !== "assistant") continue;
      const text = msg.content;

      const match =
        text.match(/```yaml\s*([\s\S]*?)```/i) ||
        text.match(/```\s*([\s\S]*?)```/);

      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  });

  return {
    messages,
    isGenerating,
    lastError,
    lastTemplate,
    sendMessage,
  };
}
