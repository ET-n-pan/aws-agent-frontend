<template>
  <div class="app-main">
    <section class="chat-panel">
      <div class="messages" ref="messagesContainer">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message-row"
          :class="msg.role"
        >
          <div class="avatar">
            <span v-if="msg.role === 'user'">You</span>
            <span v-else>Agent</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useChat } from "../composables/useChat";
import MarkdownMessage from "../components/MarkdownMessage.vue";

const { messages, isGenerating, lastError, lastTemplate, sendMessage } = useChat();

const input = ref("");
const messagesContainer = ref<HTMLDivElement | null>(null);

const canSend = computed(
  () => input.value.trim().length > 0 && !isGenerating.value
);

function onEnter() {
  if (canSend.value) onSubmit();
}

function onSubmit() {
  const text = input.value.trim();
  if (!text) return;
  sendMessage(text);
  input.value = "";
}

// auto-scroll
watch(
  () => messages.value.length,
  () => {
    if (!messagesContainer.value) return;
    requestAnimationFrame(() => {
      messagesContainer.value!.scrollTop =
        messagesContainer.value!.scrollHeight;
    });
  }
);

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
  // nothing else required; Authenticator wraps this
});
</script>

<style scoped>
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
