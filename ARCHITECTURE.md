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
- проверяет 21-day retake lock перед стартом;
- передаёт источник кандидата, опыт, `testVersion` и `bankVersion`;
- отправляет результат в Google Apps Script.

### `data/*.json`

Банки вопросов. Один тест = один JSON-файл:

```text
data/fa-junior.json   Financial Analyst Junior
data/ca-junior.json   Credit Analyst Junior
data/fpa-junior.json  FP&A / Budget Analyst Junior
data/acc-junior.json  Accounting / Reporting Junior
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

Если в JSON есть объект `blocks`, движок использует его для Skill Card. Это нужно для совместимости: например, `ca-junior.json`, `fpa-junior.json`, `acc-junior.json` и `bi-junior.json` содержат собственные блоки навыков.

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

Credit Analyst Junior содержит 80 вопросов, поэтому одна попытка показывает случайные 40. FP&A, Accounting и BI сейчас содержат по 40 вопросов, поэтому в попытку попадает весь банк с перемешанными вопросами и вариантами ответа.

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

## Retake Lock

Один кандидат может пройти разные тесты в один день, но один и тот же `testId` нельзя пройти повторно раньше чем через 21 день.

`test.html` содержит константу:

```javascript
const RETAKE_CHECK_ENABLED = true;
```

Если её временно переключить в `false`, фронтовая проверка отключится для ручного тестирования. Серверная проверка в `apps-script/Code.gs` остаётся обязательной защитой перед записью результата.

Проверка выполняется по:

```text
testId
email = trim + lowerCase
phone = только цифры
```

В Google Sheets для этого используются отдельные колонки `ID теста` и `Fingerprint`. В `ID теста` записывается машинный идентификатор (`fa-junior`, `ca-junior`, `fpa-junior`, `acc-junior`, `bi-junior`), а `Fingerprint` хранит hash технического отпечатка браузера. Колонка `Тест` хранит человекочитаемое название и не используется как основной ключ блокировки. Для старых строк без `ID теста` Apps Script оставляет fallback-сравнение по названию теста.

Retake lock блокирует попытку, если за последние 21 день для того же `testId` найдено совпадение хотя бы по одному признаку:

```text
email
phone
browserFingerprint
```

На фронте дополнительно используется `localStorage`-ключ `skillcheck_attempt_<testId>`. Он блокирует повторный старт в том же браузере до обращения к Apps Script, но не заменяет серверную проверку.

Apps Script возвращает:

```text
allowed
message
nextDate
daysLeft
previousAttemptDate
testTitle
normalizedEmail
normalizedPhone
testId
foundPreviousAttempt
browserFingerprint
matchedBy
```

Если `allowed=false`, сайт показывает кандидату понятную дату предыдущей и следующей попытки.

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
ID теста
Fingerprint
Версия теста
Версия банка
Имя
Email
Телефон
Английский
Опыт
Источник кандидата
Уход со вкладки
Баллы
Всего
Процент
Итоговый балл
Плашка
Статус
Trust Score
Следующая попытка
Ссылка на TXT отчет
```

Старые колонки удаляются при нормализации заголовков:

```text
Решение
Баллы (сырые)
Всего (сырые)
```

Запись и чтение данных в Apps Script выполняются по заголовкам, а не по жёстким номерам колонок. Это нужно, чтобы старые листы переживали добавление новых колонок.

Лист `Top Candidates` строится из `Results` и оставляет только кандидатов с:

```text
Итоговый балл >= 70
Уход со вкладки <= 2
Trust Score >= 70
```

Сортировка: сначала итоговый балл по убыванию, затем меньшее число уходов со вкладки.

## TXT-отчёт

TXT-отчёт формируется на клиенте в `test.html`, отправляется в Apps Script и сохраняется в Google Drive. В таблицу пишется ссылка на файл.

Отчёт начинается с блока `CANDIDATE SUMMARY / КРАТКОЕ РЕЗЮМЕ`, затем включает:

- профиль теста;
- версию банка;
- данные кандидата;
- источник кандидата и опыт;
- сырой и итоговый результат;
- Skill Card по блокам;
- детальный разбор вопросов;
- уходы со вкладки;
- рекомендацию.
