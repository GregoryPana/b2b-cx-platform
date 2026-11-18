"""The walkthrough files shipped in the shopper app must be intact and attachable."""
import hashlib
import os
import unittest
from pathlib import Path
from unittest import mock

ASSET_DIR = Path(__file__).resolve().parents[2] / "frontend" / "mystery-shopper" / "public" / "tutorials" / "enrollment"
EMAIL_FILES = ["enrollment-desktop-email.mp4", "enrollment-mobile-email.mp4"]


class EnrollmentVideoAssetsTest(unittest.TestCase):
    def test_checksums_match_files(self):
        lines = (ASSET_DIR / "checksums.sha256").read_text(encoding="utf-8").splitlines()
        self.assertTrue(lines, "checksums.sha256 is empty")
        listed = set()
        for line in lines:
            digest, name = line.split(" ", 1)
            name = name.lstrip("* ").strip()
            listed.add(name)
            actual = hashlib.sha256((ASSET_DIR / name).read_bytes()).hexdigest()
            self.assertEqual(digest, actual, f"{name} changed; regenerate checksums.sha256 if intentional")
        on_disk = {p.name for p in ASSET_DIR.iterdir() if p.name != "checksums.sha256"}
        self.assertEqual(listed, on_disk, "files and checksums.sha256 disagree")

    def test_both_email_videos_attach_under_the_size_cap(self):
        from app.core.enrollment_video import load_enrollment_video_attachments

        env = {
            "ENROLLMENT_VIDEO_ATTACH": "true",
            "ENROLLMENT_VIDEO_DIR": str(ASSET_DIR),
            "ENROLLMENT_VIDEO_FILES": ",".join(EMAIL_FILES),
        }
        with mock.patch.dict(os.environ, env, clear=False):
            os.environ.pop("ENROLLMENT_VIDEO_MAX_MB", None)  # use the default cap
            got = load_enrollment_video_attachments()
        self.assertEqual([g[0] for g in got], EMAIL_FILES)
        total = sum(len(g[1]) for g in got)
        # SMTP relay limit is 15.7 MB; base64 adds ~33%.
        self.assertLess(total * 4 / 3, 15 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
