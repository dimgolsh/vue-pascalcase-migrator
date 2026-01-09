#!/bin/bash

# Скрипт для быстрого тестирования миграции

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$SCRIPT_DIR/tmp/test-$$"

echo "📁 Копирование тестового проекта в $TEST_DIR..."
rm -rf "$SCRIPT_DIR/tmp"
mkdir -p "$TEST_DIR"
cp -r "$SCRIPT_DIR/basic-project/"* "$TEST_DIR/"
cd "$TEST_DIR"

echo "📝 Инициализация git..."
git init -q
git add .
git commit -q -m "Initial"

echo ""
echo "📋 Файлы ДО миграции:"
echo "----------------------------------------"
find src -name "*.vue" -o -name "*.ts" | sort

echo ""
echo "🔍 Запуск dry-run..."
echo "----------------------------------------"
node "$PROJECT_DIR/dist/index.js" rename -d src --dry-run

echo ""
read -p "Продолжить с реальной миграцией? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Запуск миграции..."
    echo "----------------------------------------"
    node "$PROJECT_DIR/dist/index.js" rename -d src
    
    echo ""
    echo "📋 Файлы ПОСЛЕ миграции:"
    echo "----------------------------------------"
    find src -name "*.vue" -o -name "*.ts" | sort
    
    echo ""
    echo "📄 Содержимое HomePage.vue:"
    echo "----------------------------------------"
    cat src/pages/HomePage.vue
    
    echo ""
    echo "📄 Содержимое App.vue:"
    echo "----------------------------------------"
    cat src/App.vue
    
    echo ""
    echo "📄 Содержимое components/index.ts:"
    echo "----------------------------------------"
    cat src/components/index.ts
fi

echo ""
echo "✅ Тестовая директория: $TEST_DIR"
echo "   Можете проверить результаты вручную"
