# Majors Tour

A scoring app for the four golf majors played each year by Jonty, Brandy and Pete:

| Major | Format |
|---|---|
| The Masters | Four rounds abroad. Stableford place points plus prizes. |
| Summer Series | The same format in the UK (number of rounds can be set). |
| Skins Major | One 18-hole skins round: 5 holes at £5, 10 at £10 and 3 at £20. Ties carry over. |
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
- **Opened from this repo or GitHub Pages:** there's no shared database, so everything is saved in that browser on that device only.
