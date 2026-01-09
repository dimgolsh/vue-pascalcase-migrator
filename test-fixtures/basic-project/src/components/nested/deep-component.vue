<script setup lang="ts">
// Вложенный компонент - должен быть переименован в DeepComponent.vue
// Тестирует импорты из родительских директорий

// Относительный импорт из родительской папки
import MyButton from '../my-button.vue'

// Относительный импорт на 2 уровня вверх
import SharedButton from '../../shared/my-button'

// Импорт через алиас
import UserCard from '@/components/user-card.vue'
</script>

<template>
  <div class="deep-component">
    <h4>Deep Component</h4>
    <MyButton label="Parent Button" />
    <SharedButton text="Shared" variant="secondary" />
    <UserCard name="Deep User" email="deep@example.com" />
  </div>
</template>

<style scoped>
.deep-component {
  border: 2px dashed #999;
  padding: 12px;
}
</style>
