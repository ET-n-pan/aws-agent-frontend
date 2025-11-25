import { ref, computed } from "vue";
import { invokeAgentRuntime } from "../agentcore/client";

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

    messages.value.push({ role: "user", content: text });
    isGenerating.value = true;
    lastError.value = null;

    try {
      const result = await invokeAgentRuntime(text, runtimeSessionId ?? undefined);
      runtimeSessionId = result.runtimeSessionId;

      messages.value.push({
        role: "assistant",
        content: result.text,
      });
    } catch (e: any) {
      console.error(e);
      lastError.value = e?.message ?? String(e);
      messages.value.push({
        role: "assistant",
        content: `Error while calling AgentCore: ${lastError.value}`,
      });
    } finally {
      isGenerating.value = false;
    }
  }

  // Extract latest ```yaml ... ``` block from assistant messages
  const lastTemplate = computed<string | null>(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i];
      if (!msg || msg.role !== "assistant") continue;
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
