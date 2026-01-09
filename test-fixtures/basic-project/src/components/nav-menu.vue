<script setup lang="ts">
// Навигационное меню - должен быть переименован в NavMenu.vue
// Импортирует my-button через относительный путь БЕЗ расширения
import MyButton from './my-button'

const items = ['Home', 'About', 'Contact']
</script>

<template>
  <nav class="nav-menu">
    <MyButton v-for="item in items" :key="item" :label="item" />
  </nav>
</template>

<style scoped>
.nav-menu {
  display: flex;
  gap: 8px;
}
</style>
