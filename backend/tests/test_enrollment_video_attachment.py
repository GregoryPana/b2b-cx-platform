import email
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

os.environ.setdefault("MYSTERY_AUTH_SECRET_KEY", "test-key")

from app.core import emailer  # noqa: E402
from app.core import enrollment_video as ev  # noqa: E402


class _FakeSMTP:
    sent = []

    def __init__(self, *a, **k):
        _FakeSMTP.timeout = k.get("timeout")

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def ehlo(self):
        pass

    def has_extn(self, _):
        return False

    def sendmail(self, sender, to, raw):
        _FakeSMTP.sent.append(raw)


SMTP_ENV = {"SMTP_HOST": "smtp.test", "SMTP_PORT": "25", "SMTP_FROM": "noreply@test", "SMTP_USE_TLS": "false"}


class SendEmailAttachmentTests(unittest.TestCase):
    def setUp(self):
        _FakeSMTP.sent = []

    def _send(self, **kw):
        with mock.patch.dict(os.environ, SMTP_ENV), mock.patch.object(emailer.smtplib, "SMTP", _FakeSMTP):
            emailer.send_email(["x@example.com"], "Subj", "text", "<p>html</p>", reply_to="a@example.com", **kw)
        return email.message_from_string(_FakeSMTP.sent[-1])

    def test_without_attachments_stays_multipart_alternative(self):
        msg = self._send()
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        self.assertEqual(msg["Reply-To"], "a@example.com")

    def test_with_attachment_is_mixed_with_readable_body_and_video(self):
        data = b"\x00\x01fakevideo" * 1000
        msg = self._send(attachments=[("walk.mp4", data, "video/mp4")])
        self.assertEqual(msg.get_content_type(), "multipart/mixed")
        parts = msg.get_payload()
        self.assertEqual(parts[0].get_content_type(), "multipart/alternative")
        self.assertEqual(parts[1].get_content_type(), "video/mp4")
        self.assertEqual(parts[1].get_filename(), "walk.mp4")
        self.assertEqual(parts[1].get_payload(decode=True), data)
        self.assertEqual(msg["Subject"], "Subj")
        self.assertEqual(_FakeSMTP.timeout, 90)


class LoaderTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.root = Path(self.dir.name)
        (self.root / "a.mp4").write_bytes(b"a" * 1000)
        (self.root / "b.mp4").write_bytes(b"b" * 2000)
        (self.root / "notes.txt").write_text("x")

    def tearDown(self):
        self.dir.cleanup()

    def load(self, **env):
        base = {"ENROLLMENT_VIDEO_ATTACH": "true", "ENROLLMENT_VIDEO_DIR": str(self.root), "ENROLLMENT_VIDEO_FILES": "a.mp4"}
        base.update(env)
        with mock.patch.dict(os.environ, base, clear=False):
            return ev.load_enrollment_video_attachments()

    def test_off_by_default(self):
        with mock.patch.dict(os.environ, {"ENROLLMENT_VIDEO_DIR": str(self.root), "ENROLLMENT_VIDEO_FILES": "a.mp4"}, clear=False):
            os.environ.pop("ENROLLMENT_VIDEO_ATTACH", None)
            self.assertEqual(ev.load_enrollment_video_attachments(), [])

    def test_loads_files(self):
        got = self.load(ENROLLMENT_VIDEO_FILES="a.mp4,b.mp4")
        self.assertEqual([g[0] for g in got], ["a.mp4", "b.mp4"])
        self.assertEqual(got[0][2], "video/mp4")

    def test_missing_file_degrades_to_no_video(self):
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES="a.mp4,nope.mp4"), [])

    def test_size_cap(self):
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES="a.mp4,b.mp4", ENROLLMENT_VIDEO_MAX_MB="0.001"), [])

    def test_rejects_paths_traversal_and_odd_types(self):
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES="../a.mp4"), [])
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES="sub/a.mp4"), [])
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES="notes.txt"), [])
        self.assertEqual(self.load(ENROLLMENT_VIDEO_FILES=".hidden.mp4"), [])


if __name__ == "__main__":
    unittest.main()
