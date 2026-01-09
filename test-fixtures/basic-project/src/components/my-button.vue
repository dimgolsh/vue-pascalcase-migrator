<script setup lang="ts">
// Компонент кнопки - должен быть переименован в MyButton.vue
defineProps<{
  label: string
}>()
</script>

<template>
  <button class="my-button">{{ label }}</button>
</template>

<style scoped>
.my-button {
  padding: 8px 16px;
}
</style>
