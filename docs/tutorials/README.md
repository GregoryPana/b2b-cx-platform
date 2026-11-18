# Tutorial videos and the drift guard

Tutorial videos (for example the Mystery Shopper enrollment walkthrough) are
recordings of the real screens. If a screen, shared style or email template
changes, the video can silently become wrong. The drift guard tells the owner.

## What is watched

`docs/tutorials/<set>/video-manifest.json` lists, per recorded screen:

- `beats`: the video steps that show the screen (so a warning says *which part* of the video is affected)
- `watch`: the files the screen depends on (a `file::function` entry watches only that Python function; `dir/*.jsx` entries watch every match, so added or removed files are caught too)
- `baseline`: SHA-256 of each watched item when the video was last recorded or confirmed

Currently: `email`, `enroll-page`, `sign-in` for the `mystery-enrollment` set (v05).

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

## Where the videos live and how they ship

Single source folder: `frontend/mystery-shopper/public/tutorials/enrollment/`. Vite copies it into the shopper app build, so **both** the internal bundle and the DMZ bundle carry the same files and nothing is fetched across VMs at run time. The DMZ bundle's `SHA256SUMS` already covers them; `backend/tests/test_enrollment_video_assets.py` also checks them against the folder's own `checksums.sha256`.

| File | Used for |
| --- | --- |
| `enrollment-desktop-720.mp4`, `enrollment-mobile-720.mp4` | Player page (captions are burned in) |
| `enrollment-*-poster.jpg`, `chapters.json` | Player page poster and "Jump to a step" list |
| `enrollment-desktop-email.mp4`, `enrollment-mobile-email.mp4` | Email attachment and the page's download link (about 3.7 MB together) |

- **Player page:** `<shopper app URL>/?tutorial=enrollment` (for example `/surveys/mystery-shopper/?tutorial=enrollment`). No sign-in; it only serves static files.
- **Email attachment (OFF by default):** on the internal backend only, set in `/opt/cwscx/.env`:
  `ENROLLMENT_VIDEO_ATTACH=true`,
  `ENROLLMENT_VIDEO_DIR=/opt/cwscx/frontends-src/public/mystery-shopper/dist/tutorials/enrollment`,
  `ENROLLMENT_VIDEO_FILES=enrollment-desktop-email.mp4,enrollment-mobile-email.mp4`, then restart `cwscx-backend`. Remove `ENROLLMENT_VIDEO_ATTACH` to switch it off. A missing file never blocks an email; it is sent without the video.
- **Updating a video:** re-record, replace the files, regenerate the sums (`cd` into the folder, `sha256sum $(ls | grep -v checksums.sha256 | sort) > checksums.sha256`), then `rebaseline` as above. Keep the two email encodes under about 8 MB in total (the SMTP relay limit is 15.7 MB after base64 growth).
