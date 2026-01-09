<script setup lang="ts">
// Главная страница - должна быть переименована в HomePage.vue
// Тестирует разные виды импортов:

// 1. Импорт через алиас @ С расширением .vue
import UserCard from '@/components/user-card.vue'

// 2. Импорт через алиас @ БЕЗ расширения
import NavMenu from '@/components/nav-menu'

// 3. Импорт из ДРУГОЙ папки с таким же именем файла
// Этот импорт должен обновиться на shared/MyButton, НЕ на components/MyButton
import SharedButton from '@/shared/my-button.vue'

// 4. Относительный импорт С расширением
import MyButton from '../components/my-button.vue'
</script>

<template>
  <div class="home-page">
    <NavMenu />
    <h1>Home Page</h1>
    <UserCard name="John" email="john@example.com" />
    <MyButton label="Click me" />
    <SharedButton text="Shared" variant="primary" />
  </div>
</template>

<style scoped>
.home-page {
  padding: 20px;
}
</style>
