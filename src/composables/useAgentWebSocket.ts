// src/composables/useAgentWebSocket.ts
import { computed, ref } from "vue";
import { useWebSocket } from "@vueuse/core";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  sessionId?: string;
};

export type WsStatus = "disconnected" | "connecting" | "connected" | "error";

export function useAgentWebSocket(wsBaseUrl: string) {
  const messages = ref<ChatMessage[]>([]);
  const sessionId = ref<string | null>(null);
  const actorId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const isGenerating = ref(false);

  const {
    status: rawStatus,
    open,
    close,
    send,
  } = useWebSocket(wsBaseUrl, {
    autoReconnect: {
      retries: 3,
      delay: 3000,
    },
    immediate: false,
    onMessage(_, event) {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (e) {
        console.error("Failed to parse WS message", e, event.data);
      }
    },
    onError(_, ev) {
      console.error("WS error", ev);
      lastError.value = "WebSocket error";
    },
    onDisconnected() {
      isGenerating.value = false;
    },
  });

  const status = computed<WsStatus>(() => {
    if (rawStatus.value === "OPEN") return "connected";
    if (rawStatus.value === "CONNECTING") return "connecting";
    if (rawStatus.value === "CLOSED") return "disconnected";
    return "error";
  });

  function handleServerMessage(data: any) {
    const type = data.type;
    switch (type) {
      case "info":
        if (data.actor_id) actorId.value = data.actor_id;
        break;
      case "ack":
        if (data.session_id) sessionId.value = data.session_id;
        isGenerating.value = true;
        break;
      case "agent_chunk":
        if (!sessionId.value && data.session_id) {
          sessionId.value = data.session_id;
        }
        messages.value.push({
          role: "assistant",
          content: String(data.content ?? ""),
          sessionId: data.session_id,
        });
        break;
      case "agent_complete":
        isGenerating.value = false;
        break;
      case "error":
        lastError.value = data.message ?? "Unknown error";
        console.error("Agent error:", data);
        isGenerating.value = false;
        break;
      case "pong":
        break;
      default:
        console.warn("Unknown WS message type:", data);
    }
  }

  function connect() {
    if (status.value === "connected" || status.value === "connecting") return;
    lastError.value = null;
    open();
  }

  function disconnect() {
    close();
  }

  function sendMessage(text: string) {
    if (status.value !== "connected") {
      throw new Error("WebSocket not connected");
    }
    const payload = {
      type: "user_message",
      session_id: sessionId.value,
      content: text,
    };
    messages.value.push({
      role: "user",
      content: text,
      sessionId: sessionId.value ?? undefined,
    });
    send(JSON.stringify(payload));
    isGenerating.value = true;
  }

  return {
    status,
    messages,
    sessionId,
    actorId,
    lastError,
    isGenerating,
    connect,
    disconnect,
    sendMessage,
  };
}
