<template>
  <authenticator>
    <template #default="{ user, signOut }">
      <div class="app">
        <header class="app-header">
          <div class="app-title">Bedrock Flow Agent</div>
          <div class="app-header-right">
            <span class="user-name">{{ user?.username }}</span>
            <button class="btn small secondary" @click="signOut">
              Sign Out
            </button>
          </div>
        </header>
        <ChatPage />
      </div>
    </template>
  </authenticator>
</template>

<script setup lang="ts">
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-vue";
import "@aws-amplify/ui-vue/styles.css";

import ChatPage from "./views/ChatPage.vue";

Amplify.configure(outputs);
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

.app-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.user-name {
  color: #4b5563;
}

.btn {
  border-radius: 999px;
  border: none;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
}

.btn.secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}
</style>
