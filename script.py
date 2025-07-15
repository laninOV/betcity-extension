# Show the final project structure
import os

def show_directory_structure(path, prefix="", max_depth=3, current_depth=0):
    if current_depth >= max_depth:
        return
    
    items = []
    try:
        for item in sorted(os.listdir(path)):
            if not item.startswith('.'):
                items.append(item)
    except PermissionError:
        return
    
    for i, item in enumerate(items):
        item_path = os.path.join(path, item)
        is_last = i == len(items) - 1
        
        current_prefix = "└── " if is_last else "├── "
        print(f"{prefix}{current_prefix}{item}")
        
        if os.path.isdir(item_path):
            extension = "    " if is_last else "│   "
            show_directory_structure(item_path, prefix + extension, max_depth, current_depth + 1)

print("=== Структура проекта ===")
print("betcity_extension/")
show_directory_structure("betcity_extension", "")

print("\n=== Файлы созданы ===")
for root, dirs, files in os.walk("betcity_extension"):
    for file in files:
        file_path = os.path.join(root, file)
        size = os.path.getsize(file_path)
        print(f"✓ {file_path} ({size} байт)")

print("\n=== Краткое описание файлов ===")
descriptions = {
    "manifest.json": "Конфигурация расширения для Chrome",
    "popup.html": "Интерфейс всплывающего окна",
    "popup.js": "Логика всплывающего окна",
    "content.js": "Основной скрипт парсинга и вычислений",
    "background.js": "Фоновый скрипт расширения",
    "styles.css": "Стили интерфейса",
    "config.js": "Конфигурационный файл для продвинутых настроек",
    "utils.js": "Вспомогательные функции",
    "test.html": "Тестовая страница для разработки",
    "README.md": "Инструкция по установке и использованию"
}

for filename, description in descriptions.items():
    print(f"• {filename}: {description}")

print("\n=== Готово! ===")
print("Проект полностью создан и готов к использованию.")
print("Следуйте инструкциям в README.md для установки расширения.")