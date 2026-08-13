<script setup lang="ts">
defineProps<{ modelValue: string; loading: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  open: []
}>()
</script>

<template>
  <form class="dataset-source" @submit.prevent="emit('open')">
    <label for="dataset-url">Dataset URL</label>
    <div class="dataset-source__row">
      <input
        id="dataset-url"
        :value="modelValue"
        type="url"
        required
        spellcheck="false"
        placeholder="https://example.org/dataset.json"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button type="submit" :disabled="loading || !modelValue.trim()">
        {{ loading ? 'Loading…' : 'Open' }}
      </button>
    </div>
  </form>
</template>
