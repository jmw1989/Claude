# Quiz Night 🍺

A mobile quiz app you can host for free on GitHub Pages and add to your phone's home screen.

- **General Knowledge quizzes**: pick categories (History, Geography, Science, Film & TV, Music, Arts & Literature, Food & Drink, Society & Culture), how many questions and the difficulty.
- **Sports quizzes**: pick sports (Football, Rugby, GAA, Cricket, Tennis, Golf, F1, Boxing, Olympics, and more).
- **The JOE Friday Pub Quiz**: a GitHub Action fetches the latest quiz from JOE every Friday and saves it into the app, so you can play it there. Past weeks stay available too.
- **The QuizQuizQuiz Friday Quiz**: the same job saves the week's questions from [quizquizquiz.com/friday](https://quizquizquiz.com/friday/). You type your answers in the app and submit them to QuizQuizQuiz, which marks them and shows the correct answers (they aren't published anywhere else).
- **The Guardian Saturday Quiz** (Thomas Eaton): questions and answers are imported, so you play it in the app: think of your answer, reveal it and mark yourself.
- **The National's Sport Quiz of the Week**: its quiz player is made to be embedded, so it runs inside the app.
- **BBC News Quiz of the Week, BBC Sport Weekly Quiz and The Week's Quiz of the Week**: these quizzes only run on their own websites, so the app shows each new one and links straight to it (in the installed app it opens in the built-in browser).
- Tracks your scores, works offline (with a built-in question bank), and has light and dark themes.

Questions come from [The Trivia API](https://the-trivia-api.com) and [Open Trivia DB](https://opentdb.com), both free and keyless.

## Put it on your phone

1. **Merge this branch into `main`.**
2. **Turn on GitHub Pages:** in the repo, go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, pick **`main`** and **`/ (root)`**, and save. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.
3. **Let the weekly job save quizzes:** go to **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**. This lets the Friday job commit the new quiz.
4. **Open the link on your phone** and add it to your home screen:
   - iPhone (Safari): tap **Share → Add to Home Screen**.
   - Android (Chrome): tap **⋮ → Install app** (or **Add to Home screen**).

To get this week's quizzes right away instead of waiting for Friday, go to **Actions → Fetch Friday quizzes → Run workflow**.

## How the JOE quiz import works

`.github/workflows/joe-quiz.yml` runs on Thursday evening, three times on Friday, on Saturday morning and on Monday (UTC), because publishing times vary. Each run:

1. Finds the newest "The JOE Friday Pub Quiz: week N" link on joe.co.uk / joe.ie.
2. Downloads the page and pulls out the questions, answer options, correct answers and any pictures (`scripts/joe-parser.mjs`).
3. Saves it to `data/joe/week-N.json` and updates `data/joe/index.json` and `latest.json`, then commits.

Runs after the week is saved do nothing, so the extra schedules are harmless.

If JOE changes its page layout and the questions can't be read, the app still shows the new week with an **Open on JOE** button. The page is attached to the workflow run (artifact `joe-debug-pages`) so the parser can be updated. You can also import a specific quiz with **Run workflow** and paste its URL into the `url` box.

The JOE quiz belongs to JOE (joe.co.uk / joe.ie). This app is intended for personal use; every imported quiz links back to the original.

## Running it locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Parser tests and a manual import:

```sh
cd scripts
npm install
npm test
node fetch-joe-quiz.mjs                    # latest week
node fetch-joe-quiz.mjs --url <quiz-url>   # a specific week
```

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The app |
| `js/sources.js` | Categories, sports and the question APIs |
| `js/offline-questions.js` | Built-in questions used when there's no signal |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline support |
| `data/joe/` | Saved JOE quizzes (written by the weekly job) |
| `data/qqq/` | Saved QuizQuizQuiz Friday Quiz questions |
| `data/guardian/` | Saved Guardian Saturday quizzes |
| `data/bbc/`, `data/bbcsport/`, `data/theweek/`, `data/national/` | Links to (and The National's embed of) weekly quizzes |
| `scripts/` | The quiz fetchers, parsers and tests |
| `.github/workflows/joe-quiz.yml` | The weekly fetch job (all quizzes) |
