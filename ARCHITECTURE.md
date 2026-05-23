# ARCHITECTURE.md

## Общая схема

SkillCheck работает как статический сайт на GitHub Pages с отправкой результатов в Google Apps Script.

```text
Пользователь
  -> index.html
  -> test.html?test=<testId>
  -> data/<testId>.json
  -> Google Apps Script
  -> Google Sheets + Google Drive TXT report
```

## Роли файлов

### `index.html`

Главная страница и карточки тестов. Дизайн и карточки не нужно переписывать без отдельной задачи.

### `test.html`

Основной движок тестирования:

- читает параметр `?test=`;
- выбирает тест из `TEST_CONFIG`;
- загружает JSON-банк вопросов;
- выбирает случайный набор вопросов;
- перемешивает вопросы и варианты ответа;
- пересчитывает индекс правильного ответа;
- показывает вопросы по одному;
- считает результат, штраф, плашку и Trust Score;
- генерирует TXT-отчёт;
- отправляет результат в Google Apps Script.

### `data/*.json`

Банки вопросов. Один тест = один JSON-файл:

```text
data/fa-junior.json   Financial Analyst Junior
data/ca-junior.json   Credit Analyst Junior
data/fpa-junior.json  FP&A Junior
data/acc-junior.json  Accounting Junior
data/bi-junior.json   Finance BI / Data Analyst Junior
```

### `apps-script/Code.gs`

Код Google Apps Script. Его нужно вручную скопировать в Apps Script и задеплоить новой версией.

## Выбор теста

`test.html` берёт `testId` из URL:

```text
test.html?test=ca-junior
```

Затем `TEST_CONFIG[testId]` указывает файл банка вопросов. Например:

```javascript
"ca-junior": {
  title: "Credit Analyst Junior",
  questionsFile: "data/ca-junior.json"
}
```

Если в JSON есть объект `blocks`, движок использует его для Skill Card. Это нужно для совместимости: например, `ca-junior.json` содержит свои блоки `logic`, `pnl`, `balance`, `cashflow`, `debt`, `excel`, `cases`, `final`.

## Random engine

В `test.html` задан лимит:

```javascript
const QUESTIONS_PER_ATTEMPT = 40;
```

Правила:

1. Если в банке меньше 40 активных вопросов, берутся все.
2. Если в банке больше 40 активных вопросов, выбираются случайные 40.
3. Выбранные вопросы дополнительно перемешиваются.
4. Варианты ответа в каждом вопросе перемешиваются.
5. Правильный ответ пересчитывается по исходному индексу.
6. Вопросы с `active: false` не попадают в попытку.

Для Credit Analyst Junior банк содержит 80 вопросов, а одна попытка показывает 40 случайных вопросов с перемешанными вариантами ответа.

Основные функции:

- `loadQuestions()` — загружает банк.
- `normalizeQuestionBank()` — приводит банк к единому виду.
- `getQuestionsPerAttempt()` — считает количество вопросов в попытке.
- `selectRandomQuestions()` — выбирает случайный поднабор.
- `prepareQuestions()` — готовит вопросы и варианты к показу.
- `normalizeQuestion()` — поддерживает совместимые поля старых банков.
- `shuffleArray()` — перемешивание.

## Античит

Сейчас реализовано:

- фиксация ухода со вкладки через `visibilitychange`;
- фиксация потери фокуса через `blur`;
- защита от двойного засчитывания через `lastTabExitAt`;
- запрет контекстного меню;
- запрет копирования и вырезания;
- запрет части hotkeys;
- один вопрос на экран;
- таймер на каждый вопрос.

Ограничение: браузер не может полностью запретить скриншоты или съёмку экрана.

## Скоринг

Сайт считает:

```text
rawScore = сумма набранных баллов
rawTotal = максимальная сумма баллов выбранных вопросов
percent = rawScore / rawTotal * 100
penalty = штраф за уходы со вкладки
finalScore = percent - penalty
```

Плашки:

```text
Junior Strong      finalScore >= 85 и мало уходов
Junior Confirmed   finalScore >= 70 и умеренное поведение
Borderline         finalScore >= 60
Not Confirmed      finalScore < 60
```

Также считается `Trust Score`, который учитывает итоговый балл, уходы со вкладки и неотвеченные вопросы.

## Google Sheets

`apps-script/Code.gs` пишет в лист `Results` такие колонки:

```text
Дата
Тест
Версия
Имя
Email
Телефон
Английский
Уход со вкладки
Баллы
Всего
Процент
Итоговый балл
Плашка
Статус
Trust Score
Ссылка на TXT отчет
```

Старые колонки удаляются при нормализации заголовков:

```text
Решение
Баллы (сырые)
Всего (сырые)
```

## TXT-отчёт

TXT-отчёт формируется на клиенте в `test.html`, отправляется в Apps Script и сохраняется в Google Drive. В таблицу пишется ссылка на файл.

Отчёт включает:

- профиль теста;
- данные кандидата;
- сырой и итоговый результат;
- Skill Card по блокам;
- детальный разбор вопросов;
- уходы со вкладки;
- рекомендацию.
