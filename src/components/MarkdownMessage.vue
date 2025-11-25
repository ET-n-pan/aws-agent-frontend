<template>
  <div class="markdown-body" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const props = defineProps<{
  content: string;
}>();

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre><code class="hljs language-${lang}">${hljs.highlight(
          code,
          { language: lang }
        ).value}</code></pre>`;
      } catch (_) {
        // fallthrough
      }
    }
    return `<pre><code class="hljs">${MarkdownIt.prototype.utils.escapeHtml(code)}</code></pre>`;
  },
});

const rendered = computed(() => md.render(props.content));
</script>

<style scoped>
.markdown-body {
  font-size: 13px;
  line-height: 1.5;
}

.markdown-body p {
  margin: 0 0 0.4em;
}

.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}

.markdown-body pre {
  background: #f3f4f6;
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
}
</style>
