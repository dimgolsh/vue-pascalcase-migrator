# Test Fixtures

## Тестовые сценарии

### basic-project

Тестирует все основные случаи:

#### Файлы для переименования:
- `src/components/my-button.vue` → `MyButton.vue`
- `src/components/user-card.vue` → `UserCard.vue`
- `src/components/nav-menu.vue` → `NavMenu.vue`
- `src/shared/my-button.vue` → `MyButton.vue` (другая папка!)
- `src/pages/home-page.vue` → `HomePage.vue`
- `src/pages/about-page.vue` → `AboutPage.vue`

#### Тестируемые виды импортов:

1. **Относительные с расширением**: `./my-button.vue`
2. **Относительные без расширения**: `./my-button`
3. **Алиасы с расширением**: `@/components/my-button.vue`
4. **Алиасы без расширения**: `@/components/my-button`
5. **Динамические импорты**: `import('@/components/my-button.vue')`
6. **Re-exports**: `export { default as X } from './my-button.vue'`

#### Критичный тест - разные файлы с одинаковым именем:

- `src/components/my-button.vue` и `src/shared/my-button.vue` - разные файлы!
- Импорт `@/components/my-button` должен стать `@/components/MyButton`
- Импорт `@/shared/my-button` должен стать `@/shared/MyButton`
- Они НЕ должны перепутаться!

## Как тестировать

```bash
# 1. Скопировать тестовый проект (чтобы не испортить оригинал)
cp -r test-fixtures/basic-project /tmp/test-basic

# 2. Инициализировать git (требуется для git mv)
cd /tmp/test-basic
git init
git add .
git commit -m "Initial"

# 3. Запустить миграцию в dry-run режиме
npx vue-pascalcase-migrator rename -d src --dry-run

# 4. Запустить миграцию
npx vue-pascalcase-migrator rename -d src

# 5. Проверить результаты
cat src/pages/HomePage.vue  # Импорты должны быть обновлены
cat src/App.vue             # Импорты должны быть обновлены
```

## Ожидаемые результаты

### src/pages/HomePage.vue (бывший home-page.vue)

```vue
<script setup lang="ts">
// Все импорты должны быть обновлены:
import UserCard from '@/components/UserCard.vue'      // было user-card.vue
import NavMenu from '@/components/NavMenu'            // было nav-menu
import SharedButton from '@/shared/MyButton.vue'      // было my-button.vue (из shared!)
import MyButton from '../components/MyButton.vue'     // было my-button.vue
</script>
```

### src/App.vue

```vue
<script setup lang="ts">
import HomePage from '@/pages/HomePage.vue'   // было home-page.vue
import AboutPage from '@/pages/AboutPage'     // было about-page
</script>
```

### src/components/index.ts

```ts
export { default as MyButton } from './MyButton.vue'  // было my-button.vue
export { default as UserCard } from './UserCard'      // было user-card
export { default as NavMenu } from './NavMenu.vue'    // было nav-menu.vue
```
