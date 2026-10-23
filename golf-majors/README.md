# Majors Tour

A scoring app for the four golf majors played each year by Jonty, Brandy and Pete:

| Major | Format |
|---|---|
| The Masters | Four rounds abroad. Stableford place points plus prizes. |
| Summer Series | The same format in the UK (number of rounds can be set). |
| Skins Major | One 18-hole skins round: 6 holes at £5, 9 at £10 and 3 at £20 (values picked on each tee). Ties carry over. |
| New Year Major | One round on New Year's Eve, same format as the Masters. |

## Scoring

**Stableford majors (each round)**
- Place points: 5 / 3 / 1 for 1st / 2nd / 3rd on stableford. A tie for 1st gives 5 each and 3rd gets 2. A tie for 2nd gives 3 each. A three-way tie gives 5 each. Countback (back 9, 6, 3, then the 18th) can be switched on per major.
- Closest to the pin on every par 3, and the longest drive on one chosen hole: 3 / 2 / 1 when all three qualify, 2 / 1 when two do, and 2 when only one does.
- Handicaps use the World Handicap System: course handicap = index × slope ÷ 113 + (course rating − par). The allowance defaults to 95%.

**Skins**
- Net skins, with shots given off the lowest handicap by default. A tied hole carries its money to the next hole.
- Running money totals for each player and a settle-up list of who pays whom.

## Put it on your phone

It installs the same way as the quiz app, from the GitHub Pages site at `https://jmw1989.github.io/Claude/golf-majors/`:

- iPhone (Safari): open the link, tap **Share → Add to Home Screen**.
- Android (Chrome): open the link, tap **⋮ → Install app** (or **Add to Home screen**).

It works offline once it has been opened, so a weak signal on the course doesn't matter.

## Files

- `index.html`: the installable app (manifest, icons and offline support are wired up here).
- `manifest.webmanifest`, `sw.js`, `icons/`: home-screen install and offline support.
- `artifact.html`: the same app in the form published as a Claude artifact (no `<html>`/`<head>` wrapper).

## Where data is saved

- **As a Claude artifact:** scores, courses and the roll of honour sync live between everyone the artifact is shared with.
- **Installed from GitHub Pages:** syncs live through Firebase Firestore once `firebase-config.js` holds the project's settings. Each phone joins with a shared club code, and all data lives under `clubs/<club code>/` in Firestore. Scores entered with no signal are kept on the phone and sent when it reconnects. Without Firebase settings, everything stays on the phone it was entered on.

## Live sync setup (Firebase)

1. Create a Firebase project at https://console.firebase.google.com (Analytics not needed).
2. **Firestore Database → Create database** (production mode, location `europe-west2`). Paste `firestore.rules` into the **Rules** tab and publish.
3. **Project settings → Your apps → Web app**: register an app and copy its `firebaseConfig` into `firebase-config.js`.
4. Each phone opens the app and enters the same club code.

## Course search

In the installed app, **Courses → Add a course** has a search box. Picking a result fills in the tees (rating, slope, par) and every hole's par and stroke index, ready to check and save.

- With no key it uses [OpenGolfAPI](https://github.com/opengolfapi/api) (free, no signup).
- With a free [GolfCourseAPI](https://golfcourseapi.com) key entered on the Courses page it uses that instead. The key is stored in the club's Firestore data, not in this repo.
- Search isn't available in the Claude artifact, because the Claude viewer blocks requests to other websites.

## Updating the app

Edit `artifact.html` (the Claude version), then run `./build.sh` to rebuild `index.html`. Bump `CACHE` in `sw.js` so installed phones pick up the change.
