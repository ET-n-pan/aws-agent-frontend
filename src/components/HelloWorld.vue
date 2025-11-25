<template>
  <div class="chat">
    <h1>Bedrock Flow Agent</h1>

    <div class="messages">
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="message"
        :class="m.role"
      >
        <strong>{{ m.role === "user" ? "You" : "Agent" }}:</strong>
        <span>{{ m.text }}</span>
      </div>
    </div>

    <form @submit.prevent="send">
      <textarea
        v-model="input"
        rows="3"
        placeholder="Ask about Bedrock Flow / CloudFormation..."
      />
      <button type="submit" :disabled="loading || !input.trim()">
        {{ loading ? "Sending..." : "Send" }}
      </button>
      <button type="button" @click="reset" :disabled="loading">
        Reset session
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { invokeAgentCore, resetSession } from "../bedrockAgentCoreClient";

type Message = {
  role: "user" | "assistant";
  text: string;
};

const messages = ref<Message[]>([]);
const input = ref("");
const loading = ref(false);

async function send() {
  if (!input.value.trim() || loading.value) return;

  const userText = input.value.trim();
  messages.value.push({ role: "user", text: userText });
  input.value = "";
  loading.value = true;

  try {
    const agentReply = await invokeAgentCore(userText);
    messages.value.push({ role: "assistant", text: agentReply });
  } catch (err: any) {
    console.error(err);
    messages.value.push({
      role: "assistant",
      text: `Error calling AgentCore: ${err?.message ?? String(err)}`,
    });
  } finally {
    loading.value = false;
  }
}

function reset() {
  resetSession();
  messages.value = [];
}
</script>

<style scoped>
.chat {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.messages {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.75rem;
  height: 400px;
  overflow-y: auto;
  background: #fafafa;
}

.message {
  margin-bottom: 0.5rem;
}

.message.user {
  text-align: right;
}

.message.assistant {
  text-align: left;
}

textarea {
  width: 100%;
  resize: vertical;
}

button {
  margin-right: 0.5rem;
}
</style>
