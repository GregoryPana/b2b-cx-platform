"""Offline regressions: no actual host, network, sudo or deployment."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import mystery_public_preflight as p


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.key = Path(self.temp.name) / 'key'
        self.known = Path(self.temp.name) / 'known'
        for file in (self.key, self.known):
            file.write_text('fixture-not-a-real-key')
            file.chmod(0o600)
        self.expected = p.privileged_suite_version([SCRIPTS / n for n in p.SUITE_NAMES])
        self.status = dict(release_id='legacy-1', git_sha='a'*40,
                           privileged_suite_version=self.expected,
                           baseline_established=False, signed_archive_verified=False,
                           recovery_required=False, pending_operation=None,
                           SECRET='DO-NOT-LEAK')
        self.inv = dict(current_release_id='legacy-1', disk_free_bytes=100000, service_uid=1000, service_gid=33,
                        metadata={n: dict(uid=0, gid=0, mode=0o755, safe=True) for n in p.META},
                        services={n: dict(active=True, running=True, main_pid=42,
                                         active_since_monotonic_us=123) for n in p.SERVICES})
        self.inv['metadata']['shared'] = dict(uid=1000, gid=33, mode=0o770, safe=True)
        self.sudo = 'User cxadmin may run the following commands on web01:\n    (root) NOPASSWD: /usr/local/sbin/cwscx-mystery-public-deploy\n'
        self.calls = []

    def collect(self, status_exit=0, sudo_exit=0, inventory_exit=0, trusted=False):
        def fake(args, input=None):
            self.calls.append((args, input))
            if args[-1] == p.SUDO:
                return sudo_exit, self.sudo
            if args[-1] == p.STATUS:
                return status_exit, json.dumps(self.status) if status_exit == 0 else 'DO-NOT-LEAK database://password'
            self.assertEqual(args[-1], 'python3 -I -')
            self.assertEqual(input, p.INVENTORY)
            return inventory_exit, json.dumps(self.inv)
        with patch.object(p, 'run', side_effect=fake), patch.object(p, 'tls_inventory', return_value={
                'inventory_ok': True, 'strict_tls_valid': False,
                'certificate_inventory_unverified': True}):
            return p.collect(self.key, self.known, 'https://web01.example/', 'trusted' if trusted else 'prepublic')

    def test_prepublic_is_not_strict_trust_or_deployment_acceptance(self):
        result = self.collect()
        self.assertTrue(result['preflight_ok'])
        self.assertFalse(result['strict_trust_gate'])
        self.assertFalse(result['deployment_acceptance'])
        self.assertFalse(result['status']['pending_operation'])
        self.assertEqual(result['status']['source_sha'], 'a'*40)
        self.assertNotIn('DO-NOT-LEAK', json.dumps(result))

    def test_trusted_mode_requires_strict_validation(self):
        self.assertIn('strict_tls_validation_failed', self.collect(trusted=True)['failures'])

    def test_fixed_ssh_and_commands(self):
        self.collect()
        for args, _ in self.calls:
            self.assertIn(p.TARGET, args)
            for required in ('StrictHostKeyChecking=yes', 'BatchMode=yes', 'IdentitiesOnly=yes',
                             'GlobalKnownHostsFile=/dev/null', 'IdentityAgent=none', 'ClearAllForwardings=yes'):
                self.assertIn(required, args)
            self.assertEqual(args[:3], ['ssh', '-F', '/dev/null'])
            self.assertIn(args[-1], (p.SUDO, p.STATUS, 'python3 -I -'))
        self.assertEqual(len(self.calls), 3)

    def test_broad_sudo_blocks_root_status(self):
        self.sudo += '    (ALL) NOPASSWD: ALL\n'
        result = self.collect()
        self.assertFalse(result['preflight_ok'])
        self.assertEqual(result['sudo_policy']['reason'], 'policy_rejected')
        self.assertNotIn(p.STATUS, [a[-1] for a, _ in self.calls])

    def test_sudo_ssh_failure_blocks_status(self):
        result = self.collect(sudo_exit=255)
        self.assertFalse(result['ssh_authenticated'])
        self.assertFalse(result['preflight_ok'])
        self.assertNotIn(p.STATUS, [a[-1] for a, _ in self.calls])

    def test_legacy_status_failure_preserves_unprivileged_identity_no_raw_error(self):
        result = self.collect(status_exit=1)
        self.assertEqual(result['root_status_exit'], 1)
        self.assertEqual(result['root_status_class'], 'status_command_failed')
        self.assertEqual(result['inventory']['current_release_id'], 'legacy-1')
        self.assertNotIn('DO-NOT-LEAK', json.dumps(result))
        self.assertFalse(result['preflight_ok'])

    def test_suite_mismatch(self):
        self.status['privileged_suite_version'] = '0'*64
        self.assertIn('privileged_suite_mismatch_bootstrap_required', self.collect()['failures'])

    def test_pending_is_only_boolean_not_journal(self):
        self.status['pending_operation'] = {'secret': 'DO-NOT-LEAK'}
        result = self.collect()
        self.assertIs(result['status']['pending_operation'], True)
        self.assertIn('pending_operation_or_recovery', result['failures'])
        self.assertNotIn('DO-NOT-LEAK', json.dumps(result))

    def test_recovery_and_current_mismatch(self):
        self.status['recovery_required'] = True
        self.status['release_id'] = 'other'
        result = self.collect()
        self.assertIn('pending_operation_or_recovery', result['failures'])
        self.assertIn('current_release_mismatch', result['failures'])

    def test_status_schema_rejects_coercion_and_injection(self):
        for key, value in [('release_id', 'DO-NOT-LEAK\npassword'), ('git_sha', 'x'),
                           ('signed_archive_verified', 'false'), ('pending_operation', []),
                           ('privileged_suite_version', 'x')]:
            with self.subTest(key=key):
                status = dict(self.status, **{key: value})
                with self.assertRaises((ValueError, KeyError)):
                    p.status_report(json.dumps(status))

    def test_unsafe_permissions_service_failure_disk_full(self):
        self.inv['metadata']['guard']['mode'] = 0o777
        self.inv['services']['nginx']['active'] = False
        self.inv['disk_free_bytes'] = 0
        result = self.collect()
        for failure in ('unsafe_permissions', 'service_not_running', 'disk_full'):
            self.assertIn(failure, result['failures'])

    def test_inventory_unavailable_or_missing_fields_fail_closed(self):
        self.assertFalse(self.collect(inventory_exit=255)['preflight_ok'])
        self.inv['metadata']['state'] = {'safe': False}
        result = self.collect()
        self.assertIn('unsafe_permissions', result['failures'])
        self.assertEqual(result['inventory']['current_release_id'], 'legacy-1')

    def test_input_guards_before_any_command(self):
        for url in ('http://web01', 'https://user:pass@web01', 'https://web01/?secret=x',
                    'https://web01/#x', 'https://web01:22', 'https://web01/path',
                    'https://web01\n', 'https://web01;id'):
            with self.subTest(url=url), patch.object(p, 'run') as run:
                result = p.collect(self.key, self.known, url, 'prepublic')
                self.assertFalse(result['preflight_ok'])
                run.assert_not_called()
        with patch.object(p, 'run') as run:
            self.assertFalse(p.collect(self.key, self.known, 'https://web01', 'insecure')['preflight_ok'])
            run.assert_not_called()

    def test_credentials_must_be_private_regular_files(self):
        self.key.chmod(0o644)
        with self.assertRaises(ValueError):
            p.ssh_args(self.key, self.known)
        self.key.unlink()
        self.key.symlink_to(self.known)
        with self.assertRaises(ValueError):
            p.ssh_args(self.key, self.known)

    def test_subprocess_timeout_and_output_limit_no_raw_errors(self):
        with patch.object(p.subprocess, 'run', side_effect=subprocess.TimeoutExpired(['ssh'], 25, output='DO-NOT-LEAK')):
            self.assertEqual(p.run(['ssh']), (124, ''))
        self.assertEqual(p.run([sys.executable, '-c', "print('x'*70000)"]), (125, ''))
        self.assertEqual(p.run([sys.executable, '-c', "import sys; sys.stderr.write('DO-NOT-LEAK'); sys.exit(1)"]), (1, ''))
        with patch.object(p.subprocess, 'run', return_value=MagicMock(returncode=1)) as run:
            self.assertEqual(p.run(['ssh']), (1, ''))
            self.assertEqual(run.call_args.kwargs['timeout'], 25)
            self.assertNotIn('DMZ_SSH_KEY', run.call_args.kwargs['env'])

    def test_real_shared_boundary_and_protected_helpers(self):
        for name in ('installer', 'guard', 'transaction'):
            self.inv['metadata'][name] = {'inspection': 'requires_privileged_status'}
        self.assertTrue(self.collect()['preflight_ok'])
        self.inv['metadata']['shared']['mode'] = 0o777
        self.assertIn('unsafe_permissions', self.collect()['failures'])

    def test_protected_helpers_do_not_hide_failed_root_status(self):
        self.inv['metadata']['guard'] = {'inspection': 'requires_privileged_status'}
        self.assertFalse(self.collect(status_exit=1)['preflight_ok'])

    def test_root_owned_or_wrong_group_shared_is_not_service_boundary(self):
        for key, bad in (('uid', 0), ('gid', 0)):
            with self.subTest(key=key):
                old = self.inv['metadata']['shared'][key]
                self.inv['metadata']['shared'][key] = bad
                self.assertIn('unsafe_permissions', self.collect()['failures'])
                self.inv['metadata']['shared'][key] = old

    def test_tls_unverified_certificate_does_not_validate_trust(self):
        sock = MagicMock()
        connection = MagicMock()
        connection.__enter__.return_value.getpeercert.return_value = b'public-certificate-fixture'
        ctx = MagicMock()
        ctx.wrap_socket.return_value = connection
        text = 'subject=CN=web01\nissuer=CN=web01\nnotAfter=Oct 16 00:00:00 2027 GMT\nX509v3 Subject Alternative Name:\n    DNS:web01\n'
        with patch.object(p.socket, 'create_connection', return_value=sock), \
                patch.object(p.ssl, 'create_default_context', side_effect=ssl_error()), \
                patch.object(p.ssl, 'SSLContext', return_value=ctx), \
                patch.object(p, 'run', return_value=(0, text)):
            result = p.tls_inventory('web01')
        self.assertFalse(result['strict_tls_valid'])
        self.assertTrue(result['inventory_ok'])
        self.assertEqual(result['public_certificate']['san'], ['DNS:web01'])
        self.assertEqual(ctx.verify_mode, p.ssl.CERT_NONE)

    def test_strict_tls_success_is_independent_of_inventory_success(self):
        ctx = MagicMock()
        # First TCP/TLS connection succeeds; separate public inventory fails.
        with patch.object(p.socket, 'create_connection', side_effect=[MagicMock(), OSError('fixture')]), \
                patch.object(p.ssl, 'create_default_context', return_value=ctx):
            result = p.tls_inventory('web01')
        self.assertTrue(result['strict_tls_valid'])
        self.assertFalse(result['inventory_ok'])
        ctx.wrap_socket.assert_called_once()

    def test_tls_failure_is_sanitized(self):
        with patch.object(p.socket, 'create_connection', side_effect=OSError('DO-NOT-LEAK')):
            result = p.tls_inventory('web01')
        self.assertFalse(result['inventory_ok'])
        self.assertNotIn('DO-NOT-LEAK', json.dumps(result))

    def test_main_persists_sanitized_failure(self):
        output = Path(self.temp.name) / 'report.json'
        with patch.object(sys, 'argv', ['preflight', '--key', str(self.key), '--known-hosts', str(self.known), '--output', str(output)]), \
                patch.object(p, 'collect', side_effect=RuntimeError('DO-NOT-LEAK')):
            self.assertEqual(p.main(), 1)
        self.assertNotIn('DO-NOT-LEAK', output.read_text())
        self.assertFalse(json.loads(output.read_text())['preflight_ok'])

    def test_workflow_security_contract(self):
        text = (SCRIPTS.parents[1] / '.github/workflows/mystery-public-preflight.yml').read_text()
        for fragment in ('workflow_dispatch:', "github.event_name == 'workflow_dispatch'", "github.ref == 'refs/heads/main'",
                         'group: mystery-public-production', 'cancel-in-progress: false', 'environment: mystery-public',
                         'runs-on: [self-hosted, linux, production]', 'contents: read', 'if: always()',
                         'persist-credentials: false', 'umask 077', "trap 'rm -f", 'chmod 600',
                         'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
                         'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
                         "-p 'test_mystery_public_preflight.py'"):
            self.assertIn(fragment, text)
        for forbidden in ('pull_request:', 'push:', 'schedule:', 'inputs:', 'SIGNING_KEY', 'scp ', 'tee ',
                          'restart', 'reload', 'migration', 'contents: write'):
            self.assertNotIn(forbidden, text)
        self.assertEqual(text.count('secrets.'), 3)
        self.assertEqual(text.count('environment:'), 1)

    def test_remote_program_only_allows_read_metadata_operations(self):
        compile(p.INVENTORY, '<fixed inventory>', 'exec')
        for forbidden in ('.env', 'ExecStart', '/proc/', 'sudo', 'restart', 'reload', 'read_text', 'read_bytes', 'os.environ', 'ss -p'):
            self.assertNotIn(forbidden, p.INVENTORY)
        self.assertIn("'--property=MainPID'", p.INVENTORY)
        self.assertEqual(p.STATUS, 'sudo -n /usr/local/sbin/cwscx-mystery-public-deploy --action status')


def ssl_error():
    return p.ssl.SSLCertVerificationError('untrusted fixture')


if __name__ == '__main__':
    unittest.main()
