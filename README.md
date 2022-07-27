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
- [ ] Реализовать получение данных ретвита цитирования
- [ ] Рефакторинг

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
          },
          {
            "id": "1550545593260466176",
            "full_text": "This is text of tweet",
            "video": "https://video.twimg.com/ext_tw_video/1551319195673042944/pu/vid/540x438/k8LmL7w8usmMUehX.mp4?tag=12",
            "photo": "https://pbs.twimg.com/media/FYgMgjwUsAAyWgp.jpg",
            "outer_url": "https://rol.st/3PJVXoM",
            "parent": {},
          }
        ]
    }
]
```
