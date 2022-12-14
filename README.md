# Парсер для твитттера

## Вопросы

- [x] Как оформлять тред твитов?

## TODO:

- [x] Получение страницы пользователя
  - [x] Получение id последних твиттов
- [x] Получение страницы твитта
  - [x] Получение данных твитта
- [x] Сохранение логина пользователя и id последнего твитта в mongodb
- [x] Сделать что-то с ссылками в конце поста (Просто удаляю)
- [x] Парсинг массива логинов пользователей
- [x] HomeConversation tweet type
- [x] Реализовать получение данных ретвита цитирования
- [x] Рефакторинг

## Возможности

- [x] Возможность передавать в функцию логин пользователя
- [x] Работа с MongoDB
  - [x] Сохранение пары Пользователь - id последнего твитта
- [ ] Запросы с иностранных IP (?)
- [x] Если логин новый - парсить 10 последних твиттов
- [x] Ссылки оформлять в виде HTML ссылок

## Формат данных

```
[
    {
        "login": "elonmusk",
        "tweet": [
          {
            "id": "1550545593260466176",
            "full_text": "This is text of tweet",
            "video": "https://video.twimg.com/ext_tw_video/1551319195673042944/pu/vid/540x438/k8LmL7w8usmMUehX.mp4?tag=12",
            "photo": "https://pbs.twimg.com/media/FYgMgjwUsAAyWgp.jpg",
            "outer_url": "https://rol.st/3PJVXoM",
            "parent": {},
            "status": "Quotation",
          },
          {
            "id": "1550545593260466176",
            "full_text": "This is text of tweet",
            "video": "https://video.twimg.com/ext_tw_video/1551319195673042944/pu/vid/540x438/k8LmL7w8usmMUehX.mp4?tag=12",
            "photo": "https://pbs.twimg.com/media/FYgMgjwUsAAyWgp.jpg",
            "outer_url": "https://rol.st/3PJVXoM",
            "status": "Tweet",
          }
        ]
    }
]
```

## Инструкция

1. Клонировать репозиторий на свой компьютер с помощью команды `git clone https://github.com/SpryMann/parse-twitter.git` или непосредственно скачать архив .zip
2. Открыть терминал и в папке с кодом запустить команду `npm install` (node.js должен быть установлен на компьютере, можно проверить командой `node --version` и `npm --version`)
3. Создать в корневой директории файл `.env`, дописать в нем следующее:

```
TWITTER_BASE=https://twitter.com
MONGO_URL=mongodb://127.0.0.1:27017/twitter
```

4. В файле `index.js` из файла `parser.js` импортируется функция `parse` и вызывается, в которую в качестве параметров передавать массив логинов пользователей
5. Код запускать командой в терминале `node index.js`
6. Конечный результат будет находиться в файле `data.json`
