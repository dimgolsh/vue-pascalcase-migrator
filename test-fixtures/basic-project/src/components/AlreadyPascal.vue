<script setup lang="ts">
// Этот компонент уже в PascalCase - НЕ должен переименовываться
// Но импорты внутри ДОЛЖНЫ обновиться

import MyButton from './my-button.vue'
import NavMenu from './nav-menu'
import DeepComponent from './nested/deep-component.vue'
</script>

<template>
  <div class="already-pascal">
    <h3>Already Pascal Case</h3>
    <MyButton label="Test" />
    <NavMenu />
    <DeepComponent />
  </div>
</template>

<style scoped>
.already-pascal {
  background: #f0f0f0;
}
</style>
