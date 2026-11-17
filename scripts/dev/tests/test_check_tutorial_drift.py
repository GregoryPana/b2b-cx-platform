"""Tests for scripts/dev/check_tutorial_drift.py (run: python -m unittest discover -s scripts/dev/tests)."""
import importlib.util
import io
import json
import shutil
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "check_tutorial_drift.py"
spec = importlib.util.spec_from_file_location("cdg", SCRIPT)
cdg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cdg)

PY = "def keep():\n    return 1\n\n\ndef watched():\n    return 'a'\n"


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self._repo = cdg.REPO
        cdg.REPO = self.tmp
        (self.tmp / "app").mkdir()
        (self.tmp / "ui").mkdir()
        (self.tmp / "app" / "mod.py").write_text(PY)
        (self.tmp / "ui" / "Screen.jsx").write_text("export default 1;\n")
        (self.tmp / "ui" / "a.css").write_text("a{}\n")
        self.manifest_path = self.tmp / "manifest.json"
        cdg.save(self.manifest_path, {
            "video_set": "t", "video_version": "v1", "history": [],
            "screens": [{"id": "s1", "title": "S1", "videos": ["d"], "beats": ["b1"],
                         "watch": ["app/mod.py::watched", "ui/Screen.jsx", "ui/*.css"], "baseline": {}}],
        })
        self.run_cli("rebaseline", "--screen", "all", "--reason", "initial baseline for test")

    def tearDown(self):
        cdg.REPO = self._repo
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_cli(self, *args):
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = cdg.main(["--manifest", str(self.manifest_path), *args])
        return rc, buf.getvalue()


class DriftTests(Base):
    def test_clean_tree_passes(self):
        rc, out = self.run_cli("check", "--strict")
        self.assertEqual(rc, 0)
        self.assertIn("OK", out)

    def test_modified_file_is_flagged_loudly(self):
        (self.tmp / "ui" / "Screen.jsx").write_text("export default 2;\n")
        rc, out = self.run_cli("check", "--strict")
        self.assertEqual(rc, 1)
        self.assertIn("TUTORIAL VIDEOS MAY NOW BE WRONG", out)
        self.assertIn("ui/Screen.jsx", out)
        self.assertIn("b1", out)

    def test_default_check_warns_but_does_not_fail(self):
        (self.tmp / "ui" / "Screen.jsx").write_text("changed\n")
        rc, out = self.run_cli("check")
        self.assertEqual(rc, 0)
        self.assertIn("MAY NOW BE WRONG", out)

    def test_added_and_removed_glob_files(self):
        (self.tmp / "ui" / "b.css").write_text("b{}\n")
        self.assertIn("added", self.run_cli("check")[1])
        (self.tmp / "ui" / "b.css").unlink()
        (self.tmp / "ui" / "a.css").unlink()
        self.assertIn("removed", self.run_cli("check")[1])

    def test_only_the_watched_function_counts(self):
        (self.tmp / "app" / "mod.py").write_text(PY.replace("return 1", "return 2"))  # other function
        self.assertEqual(self.run_cli("check", "--strict")[0], 0)
        (self.tmp / "app" / "mod.py").write_text(PY.replace("return 'a'", "return 'b'"))  # watched function
        self.assertEqual(self.run_cli("check", "--strict")[0], 1)

    def test_line_endings_do_not_flag(self):
        (self.tmp / "ui" / "Screen.jsx").write_bytes(b"export default 1;\r\n")
        self.assertEqual(self.run_cli("check", "--strict")[0], 0)

    def test_acknowledge_needs_a_reason_and_is_logged(self):
        (self.tmp / "ui" / "Screen.jsx").write_text("changed\n")
        with self.assertRaises(SystemExit):
            self.run_cli("acknowledge", "--screen", "s1", "--reason", "x")
        self.assertEqual(self.run_cli("check", "--strict")[0], 1)
        self.run_cli("acknowledge", "--screen", "s1", "--reason", "css only, no visual change")
        self.assertEqual(self.run_cli("check", "--strict")[0], 0)
        last = cdg.load(self.manifest_path)["history"][-1]
        self.assertEqual(last["kind"], "acknowledged-no-visible-change")
        self.assertTrue(any("ui/Screen.jsx" in c for c in last["changes_covered"]))

    def test_rebaseline_bumps_video_version(self):
        (self.tmp / "ui" / "Screen.jsx").write_text("redesigned\n")
        self.run_cli("rebaseline", "--screen", "s1", "--video-version", "v2", "--reason", "re-recorded after redesign")
        m = cdg.load(self.manifest_path)
        self.assertEqual(m["video_version"], "v2")
        self.assertEqual(self.run_cli("check", "--strict")[0], 0)

    def test_markdown_output_has_marker_and_steps(self):
        (self.tmp / "ui" / "Screen.jsx").write_text("changed\n")
        _, out = self.run_cli("check", "--format", "markdown")
        self.assertIn(cdg.MARKER, out)
        self.assertIn("b1", out)


class ChangedSinceTests(Base):
    def git(self, *a):
        subprocess.run(["git", *a], cwd=self.tmp, check=True, capture_output=True)

    def test_preexisting_drift_does_not_fail_unrelated_change_but_new_drift_does(self):
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.git("checkout", "-q", "-b", "feature")
        (self.tmp / "other.txt").write_text("x\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "unrelated")
        self.assertEqual(self.run_cli("check", "--changed-since", "main")[0], 0)
        (self.tmp / "ui" / "Screen.jsx").write_text("changed\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "touches screen")
        rc, out = self.run_cli("check", "--changed-since", "main")
        self.assertEqual(rc, 1)
        self.assertIn("[changed in this change]", out)


if __name__ == "__main__":
    unittest.main()
