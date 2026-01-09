<script setup lang="ts">
// Главный компонент приложения - уже в PascalCase, не должен меняться
// Но импорты внутри должны обновиться

import HomePage from '@/pages/home-page.vue'
import AboutPage from '@/pages/about-page'

import { ref } from 'vue'

const currentPage = ref<'home' | 'about'>('home')
</script>

<template>
  <div id="app">
    <HomePage v-if="currentPage === 'home'" />
    <AboutPage v-else />
  </div>
</template>
