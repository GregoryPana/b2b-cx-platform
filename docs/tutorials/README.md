# Tutorial videos and the drift guard

Tutorial videos (for example the Mystery Shopper enrollment walkthrough) are
recordings of the real screens. If a screen, shared style or email template
changes, the video can silently become wrong. The drift guard tells the owner.

## What is watched

`docs/tutorials/<set>/video-manifest.json` lists, per recorded screen:

- `beats`: the video steps that show the screen (so a warning says *which part* of the video is affected)
- `watch`: the files the screen depends on (a `file::function` entry watches only that Python function; `dir/*.jsx` entries watch every match, so added or removed files are caught too)
- `baseline`: SHA-256 of each watched item when the video was last recorded or confirmed

Currently: `email`, `enroll-page`, `sign-in` for the `mystery-enrollment` set (v03).

## What happens when something changes

- **Pull requests** (`.github/workflows/tutorial-drift-guard.yml`): if the PR changes a watched item, the check turns red, a warning annotation per file appears, and a sticky comment lists the affected video steps. **It is a warning, not a gate**: it is not a required check, so merging is still possible.
- **Locally:** `python scripts/dev/check_tutorial_drift.py check` prints a loud banner. Add `--strict` to make it exit 1.

## Clearing the warning (always explicit, always logged)

```bash
# The video must change: re-record, then record that you did
python scripts/dev/check_tutorial_drift.py rebaseline --screen enroll-page --video-version v04 --reason "re-recorded after enrollment redesign"

# The change does not alter what viewers see
python scripts/dev/check_tutorial_drift.py acknowledge --screen enroll-page --reason "CSS refactor, no visual change"
```

Both update the baseline hashes and append to `history` in the manifest (date, reason, files covered, commit). Commit the manifest.

## Limits

- A hash shows that a file changed, not that the picture changed. Expect some harmless flags; that is the intended trade-off.
- Screens depend on more than the listed files (for example the app shell or API data). If a new file starts to affect a recorded screen, add it to `watch`.
- Not watched yet: the capture/render project that produces the videos, which still lives outside this repository.
- Tests: `python -m unittest discover -s scripts/dev/tests`.
