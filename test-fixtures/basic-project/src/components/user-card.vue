<script setup lang="ts">
// Компонент карточки пользователя - должен быть переименован в UserCard.vue
// Импортирует my-button через относительный путь С расширением
import MyButton from './my-button.vue'

defineProps<{
  name: string
  email: string
}>()
</script>

<template>
  <div class="user-card">
    <h3>{{ name }}</h3>
    <p>{{ email }}</p>
    <MyButton label="Edit" />
  </div>
</template>

<style scoped>
.user-card {
  border: 1px solid #ccc;
  padding: 16px;
}
</style>
