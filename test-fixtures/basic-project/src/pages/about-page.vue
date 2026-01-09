<script setup lang="ts">
// Страница About - должна быть переименована в AboutPage.vue
// Тестирует динамические импорты

import { defineAsyncComponent } from 'vue'

// Динамический импорт С расширением
const AsyncUserCard = defineAsyncComponent(() => import('@/components/user-card.vue'))

// Динамический импорт БЕЗ расширения
const AsyncNavMenu = defineAsyncComponent(() => import('@/components/nav-menu'))

// Динамический импорт через относительный путь
const AsyncButton = defineAsyncComponent(() => import('../components/my-button.vue'))
</script>

<template>
  <div class="about-page">
    <h1>About Page</h1>
    <AsyncNavMenu />
    <AsyncUserCard name="Jane" email="jane@example.com" />
    <AsyncButton label="Dynamic Button" />
  </div>
</template>

<style scoped>
.about-page {
  padding: 20px;
}
</style>
