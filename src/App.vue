<template>
  <div class="app">
    <header class="app-header">
      <div class="app-title">Bedrock Flow Agent</div>
      <div class="app-status">
        <span
          class="status-dot"
          :class="{
            connected: status === 'connected',
            connecting: status === 'connecting',
            error: status === 'error'
          }"
        ></span>
        <span class="status-text">{{ statusLabel }}</span>
        <button
          v-if="status !== 'connected'"
          class="btn small"
          @click="connect"
        >
          Connect
        </button>
        <button
          v-else
          class="btn small secondary"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>
    </header>

    <main class="app-main">
      <section class="chat-panel">
        <div class="messages" ref="messagesContainer">
          <div
            v-for="(msg, index) in mergedMessages"
            :key="index"
            class="message-row"
            :class="msg.role"
          >
            <div class="avatar">
              <span v-if="msg.role === 'user'">You</span>
              <span v-else-if="msg.role === 'assistant'">Agent</span>
              <span v-else>System</span>
            </div>
            <div class="bubble">
              <MarkdownMessage :content="msg.content" />
            </div>
          </div>

          <div
            v-if="isGenerating"
            class="message-row assistant"
          >
            <div class="avatar">
              Agent
            </div>
            <div class="bubble typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <form class="input-bar" @submit.prevent="onSubmit">
          <textarea
            v-model="input"
            class="input-textarea"
            rows="1"
            placeholder="Send a message..."
            @keydown.enter.exact.prevent="onEnter"
          ></textarea>
          <button
            type="submit"
            class="btn primary"
            :disabled="!canSend"
          >
            Send
          </button>
        </form>

        <div v-if="lastError" class="error-banner">
          {{ lastError }}
        </div>
      </section>

      <aside class="side-panel">
        <h2>Template Tools</h2>
        <p class="small">
          When the agent returns a CloudFormation template inside
          <code> ```yaml ... ``` </code> code blocks, you can download the
          latest one here.
        </p>

        <textarea
          class="template-preview"
          :value="lastTemplate || ''"
          placeholder="No YAML template detected yet."
          readonly
        ></textarea>

        <button
          class="btn secondary full"
          :disabled="!lastTemplate"
          @click="downloadTemplate"
        >
          Download latest template (template.yaml)
        </button>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  useAgentWebSocket,
  type ChatMessage,
} from "./composables/useAgentWebSocket";
import MarkdownMessage from "./components/MarkdownMessage.vue";

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

const {
  status,
  messages,
  lastError,
  isGenerating,
  connect,
  disconnect,
  sendMessage,
} = useAgentWebSocket(WS_BASE_URL);

const input = ref("");
const messagesContainer = ref<HTMLDivElement | null>(null);

const mergedMessages = computed<ChatMessage[]>(() => {
  const result: ChatMessage[] = [];
  for (const msg of messages.value) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role && msg.role === "assistant") {
      last.content += msg.content;
    } else {
      result.push({ ...msg });
    }
  }
  return result;
});

const statusLabel = computed(() => {
  switch (status.value) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
});

const canSend = computed(
  () => status.value === "connected" && input.value.trim().length > 0
);

function onEnter() {
  if (canSend.value) onSubmit();
}

function onSubmit() {
  const text = input.value.trim();
  if (!text || status.value !== "connected") return;
  sendMessage(text);
  input.value = "";
}

// auto-scroll
watch(
  () => mergedMessages.value.length,
  () => {
    if (!messagesContainer.value) return;
    requestAnimationFrame(() => {
      messagesContainer.value!.scrollTop =
        messagesContainer.value!.scrollHeight;
    });
  }
);

// --- YAML template extraction & download ---

const lastTemplate = computed<string | null>(() => {
  for (let i = mergedMessages.value.length - 1; i >= 0; i--) {
    const msg = mergedMessages.value[i];
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

function downloadTemplate() {
  if (!lastTemplate.value) return;
  const blob = new Blob([lastTemplate.value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template.yaml";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

onMounted(() => {
  connect();
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.app-title {
  font-weight: 600;
  font-size: 16px;
}

.app-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #9ca3af;
}
.status-dot.connected {
  background: #22c55e;
}
.status-dot.connecting {
  background: #facc15;
}
.status-dot.error {
  background: #ef4444;
}

.status-text {
  font-size: 13px;
  color: #4b5563;
}

.app-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.chat-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  font-size: 11px;
  color: #6b7280;
  min-width: 40px;
  text-align: center;
}

.bubble {
  max-width: 80%;
  padding: 8px 10px;
  border-radius: 12px;
  background: #e5e7eb;
  font-size: 13px;
}

.message-row.user .bubble {
  background: #4f46e5;
  color: white;
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
  padding: 8px 10px;
}

.typing-indicator span {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #d1d5db;
  animation: typing 1.2s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-indicator span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.input-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.input-textarea {
  flex: 1;
  resize: none;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.4;
  max-height: 120px;
}

.input-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.btn {
  border-radius: 999px;
  border: none;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
}

.btn.primary {
  background: #4f46e5;
  color: #ffffff;
}

.btn.primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn.secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn.full {
  width: 100%;
}

.error-banner {
  padding: 6px 12px;
  font-size: 12px;
  color: #b91c1c;
  background: #fee2e2;
  border-top: 1px solid #fecaca;
}

.side-panel {
  flex: 1;
  padding: 16px;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.side-panel h2 {
  margin: 0 0 4px;
  font-size: 14px;
}

.side-panel .small {
  margin: 0 0 8px;
  font-size: 12px;
  color: #4b5563;
}

.template-preview {
  flex: 1;
  width: 100%;
  resize: none;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  padding: 8px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  background: #f9fafb;
}
</style>
