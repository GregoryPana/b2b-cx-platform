import os
import unittest
from datetime import timedelta

os.environ.setdefault("MYSTERY_AUTH_SECRET_KEY", "test-key")

from app.api import mystery_auth as m  # noqa: E402

TOKEN = "FI7Vmiyy_e3xvSW8dP-4jSdP0kC4FLf310IhR-7P-IE0"
URL = f"https://cwscx-web01.cwsey.com/?enroll={TOKEN}"


def _build(minutes: int, name: str = "Gregory Panagary"):
    expires_at = m.utcnow() + timedelta(minutes=minutes)
    return expires_at, m._build_enrollment_email(name, URL, expires_at, "Admin", "admin@example.com")


class EnrollmentEmailTests(unittest.TestCase):
    def test_expiry_is_shown_in_seychelles_time(self):
        expires_at, (_, text_body, html_body) = _build(30)
        local = expires_at.astimezone(m.SEYCHELLES_TZ).strftime("%H:%M")
        self.assertIn(f"{local} (Seychelles time)", text_body)
        self.assertIn(f"{local} (Seychelles time)", html_body)
        self.assertNotIn("UTC", text_body)

    def test_validity_wording(self):
        for minutes, expected in ((30, "30 minutes"), (60, "1 hour"), (1440, "24 hours"), (4320, "3 days")):
            _, (_, text_body, _) = _build(minutes)
            self.assertIn(f"valid for {expected}", text_body)

    def test_full_link_is_a_clickable_anchor_in_html(self):
        _, (_, _, html_body) = _build(30)
        self.assertGreaterEqual(html_body.count(f'href="{URL}"'), 2)  # button + copyable link

    def test_signoff_and_authenticator_guidance(self):
        _, (_, text_body, html_body) = _build(30)
        for body in (text_body, html_body):
            self.assertIn("CWS Team", body)
            self.assertNotIn("CX Team", body)
            self.assertIn("Microsoft Authenticator", body)
            self.assertIn("Google Authenticator", body)
            self.assertIn("play.google.com", body)
            self.assertIn("apps.apple.com", body)

    def test_name_is_html_escaped(self):
        _, (_, _, html_body) = _build(30, name="<script>x</script>")
        self.assertNotIn("<script>", html_body)


if __name__ == "__main__":
    unittest.main()


class EnrollmentVideoEmailTests(unittest.TestCase):
    def test_default_email_is_unchanged_and_mentions_no_video(self):
        _, (_, text_body, html_body) = _build(30)
        for body in (text_body, html_body):
            self.assertNotIn("video", body.lower())
            self.assertNotIn("attached", body.lower())

    def test_video_block_only_when_attached(self):
        expires_at = m.utcnow() + timedelta(minutes=30)
        _, text_body, html_body = m._build_enrollment_email("A B", URL, expires_at, "Admin", "a@example.com", has_video=True)
        for body in (text_body, html_body):
            self.assertIn("attached to this email", body)
            self.assertIn("before you connect to the VPN", body)
        # the video note comes before Step 1
        self.assertLess(text_body.index("WATCH FIRST"), text_body.index("STEP 1"))
