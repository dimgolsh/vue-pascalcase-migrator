<script setup lang="ts">
// ДРУГОЙ компонент кнопки в shared - тоже должен быть переименован
// Но импорты в других файлах НЕ должны путать этот файл с components/my-button.vue
defineProps<{
  text: string
  variant: 'primary' | 'secondary'
}>()
</script>

<template>
  <button class="shared-button" :class="variant">{{ text }}</button>
</template>

<style scoped>
.shared-button {
  border-radius: 4px;
}
</style>
