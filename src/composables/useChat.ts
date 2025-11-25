// src/composables/useChat.ts
import { ref } from "vue";
import type { ChatMessage } from "./types"; // or inline type
import { streamAgentRuntime } from "../agentcore/client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function useChatStreaming() {
  const messages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  const lastError = ref<string | null>(null);
  let runtimeSessionId: string | null = null;

  async function sendMessage(prompt: string) {
    const text = prompt.trim();
    if (!text) return;

    // user message
    messages.value.push({ role: "user", content: text });

    // assistant placeholder
    const idx = messages.value.length;
    messages.value.push({ role: "assistant", content: "" });

    isGenerating.value = true;
    lastError.value = null;

    try {
      for await (const event of streamAgentRuntime(text, runtimeSessionId ?? undefined)) {
        if (event.type === "data") {
          // Just append raw text for now; if event.text is JSON, parse here.
          messages.value[idx].content += event.text;
        } else if (event.type === "raw-json") {
          messages.value[idx].content += "\n" + JSON.stringify(event.json, null, 2);
        } else if (event.type === "done") {
          // streaming finished
        }
      }
    } catch (e: any) {
      console.error(e);
      lastError.value = e?.message ?? String(e);
      messages.value[idx].content += `\n\n[Agent error] ${lastError.value}`;
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    messages,
    isGenerating,
    lastError,
    sendMessage,
  };
}
