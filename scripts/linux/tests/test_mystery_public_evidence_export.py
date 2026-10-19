#!/usr/bin/env python3
"""Root DAC/installed CLI regression. Run ONLY in a disposable network-none container.
Not an SSH/sudo integration test; runuser proves the nonroot direct-read denial.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('guard', SOURCE / 'mystery_public_release_guard.py')
if spec is None or spec.loader is None:
    raise RuntimeError('cannot load guard')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


def report(release='candidate'):
    return dict(schema_version=1, generated_at_utc='2026-10-19T00:00:00Z',
                tls_verification_mode='prepublic', service_name='cwscx-mystery-public-backend',
                summary=dict(total=18, passed=18, failed=0), checks=[
                    dict(name=n, status='pass', detail=f'release_id={release}; git_sha='+'a'*40
                         if n == 'release_identity' else 'PRIVATE_DIAGNOSTIC_MUST_NOT_EXPORT')
                    for n in sorted(g.EVIDENCE_CHECK_NAMES)])


class SchemaTests(unittest.TestCase):
    def test_sanitization_and_identity(self):
        clean = g._sanitize_verification(report(), 'candidate')
        self.assertNotIn('PRIVATE_DIAGNOSTIC', json.dumps(clean))
        with self.assertRaises(g.GuardError):
            g._sanitize_verification(report(), 'wrong')

    def test_json_encodings_duplicates_and_constants(self):
        for raw in [b'{"x":1,"x":2}', b'{"x":NaN}', '{}'.encode('utf-16'), b'\xff']:
            with self.subTest(raw=raw), self.assertRaises((ValueError, UnicodeError)):
                g._evidence_json(raw)

    def test_bad_schema(self):
        for mutate in [lambda d: d.update(secret='NO'), lambda d: d['checks'].append(d['checks'][0]),
                       lambda d: d['summary'].update(total=True), lambda d: d.update(service_name='other'),
                       lambda d: d['checks'][0].update(name='private'), lambda d: d.update(schema_version=True)]:
            d=report(); mutate(d)
            with self.assertRaises(g.GuardError): g._sanitize_verification(d, 'candidate')

    def test_runner_transport_partial_failure_and_workflow_coverage(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            script = r'''source "$1"
SSH_OPTS=(); DMZ_USER=fixture; DMZ_HOST=invalid.invalid
ssh() { printf '{"partial":'; return 7; }
printf 'stale' >"$2"
if fetch_mystery_evidence verification candidate "$2"; then exit 20; fi
test ! -e "$2" || exit 21
ssh() { printf '{"ok":true}'; }
fetch_mystery_evidence verification candidate "$2" || exit 22
'''
            r=subprocess.run(['bash','-c',script,'fixture',str(SOURCE/'fetch_mystery_public_evidence.sh'),temp+'/output'],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertEqual(json.loads(Path(temp+'/output').read_text()),{'ok':True})
        workflow=(SOURCE.parents[1]/'.github/workflows/deploy-mystery-public.yml').read_text()
        self.assertNotIn(':/var/lib/cwscx-mystery-public/deploy-evidence/',workflow)
        self.assertEqual(workflow.count('source scripts/linux/fetch_mystery_public_evidence.sh'),4)
        self.assertEqual(workflow.count('fetch_mystery_evidence audit'),4)
        self.assertEqual(workflow.count('fetch_mystery_evidence recovery'),4)
        self.assertEqual(workflow.count('fetch_mystery_evidence verification'),3)

    def test_recovery_origin_is_not_failed_target(self):
        self.assertEqual(g._sanitize_recovery(report('origin'), 'candidate')['summary']['passed'], 18)
        d=dict(failed_release_id='candidate', restored_release_id='origin', recovery='fixed_config_snapshot', approved_fallback=False)
        self.assertEqual(g._sanitize_recovery(d, 'candidate'), d)
        with self.assertRaises(g.GuardError): g._sanitize_recovery(d, 'wrong')


@unittest.skipUnless(os.geteuid() == 0 and os.environ.get('CWSCX_EXPORT_DISPOSABLE') == '1',
                     'root CLI fixture requires explicit disposable container')
class RootCliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['useradd', '-M', 'cxadmin'], check=True)
        target=Path('/opt/cwscx-mystery-public'); target.mkdir()
        (target/'releases').mkdir(); (target/'shared').mkdir(mode=0o750)
        shutil.chown(target/'shared', user='cxadmin', group='www-data')
        (target/'.env').write_text('FIXTURE_ONLY=not-a-secret\n'); (target/'.env').chmod(0o600)
        cls.state=Path('/var/lib/cwscx-mystery-public'); cls.state.mkdir(mode=0o700)
        (cls.state/'deploy.lock').write_text('')
        if not Path('/usr/bin/python3').exists():
            Path('/usr/bin/python3').symlink_to(sys.executable)
        for n in ['incoming', 'application-archives', 'operation-nonces']: (cls.state/n).mkdir(mode=0o700)
        cls.evidence=cls.state/'deploy-evidence'; cls.evidence.mkdir(mode=0o755)
        cls.entry=Path('/usr/local/sbin/cwscx-mystery-public-deploy')
        support=Path('/usr/local/libexec/cwscx-mystery-public'); support.mkdir(parents=True)
        paths=[cls.entry]+[support/n for n in ['install_mystery_public_bundle.sh', 'mystery_public_release_guard.py', 'mystery_public_bootstrap_transaction.py']]
        for src,dst in zip(['cwscx_mystery_public_deploy_entrypoint.sh', 'install_mystery_public_bundle.sh', 'mystery_public_release_guard.py', 'mystery_public_bootstrap_transaction.py'], paths):
            shutil.copyfile(SOURCE/src,dst); dst.chmod(0o755)
        (support/'privileged-suite-version').write_text(g.privileged_suite_version(paths)+'\n')
        trust=Path('/etc/cwscx-mystery-public'); trust.mkdir(); (trust/'release-allowed-signers').write_text('fixture-only\n')

    def setUp(self):
        for p in self.evidence.iterdir(): p.unlink()
        self.path=self.evidence/'candidate.json'; self.path.write_text(json.dumps(report())); self.path.chmod(0o644)

    def cli(self,*args):
        return subprocess.run(['/bin/bash',str(self.entry),*args],env={**os.environ,'SUDO_USER':'cxadmin'},capture_output=True,text=True)

    def export(self): return self.cli('--action','evidence','--kind','verification','--release-id','candidate')

    def test_nonroot_denied_root_fixed_cli_exports_without_state_mutation(self):
        direct=subprocess.run(['runuser','-u','cxadmin','--','cat',str(self.path)],capture_output=True)
        self.assertNotEqual(direct.returncode,0); self.assertIn(b'Permission denied',direct.stderr)
        # Include an authoritative pending sentinel: export must not parse/reconcile it.
        pending=self.state/'active-operation.json'; pending.write_text('DO NOT TOUCH')
        try:
            before={str(p):p.read_bytes() for p in self.state.rglob('*') if p.is_file()}
            result=self.export(); self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(result.stdout)['summary']['passed'],18)
            self.assertNotIn('PRIVATE_DIAGNOSTIC', result.stdout)
            self.assertEqual(self.state.stat().st_mode & 0o777,0o700)
            after={str(p):p.read_bytes() for p in self.state.rglob('*') if p.is_file()}
            # Existing fixed lock is acquired; no journal/artifact mutation is permitted.
            before.pop(str(self.state/'deploy.lock'),None); after.pop(str(self.state/'deploy.lock'),None)
            self.assertEqual(before,after)
        finally: pending.unlink()

    def test_cli_rejects_unsigned_mutation_and_selector_mixing(self):
        cases=[['--action',a] for a in ['deploy','rollback','recover','establish_baseline']]
        cases += [['--action','evidence','--kind','verification','--release-id',s] for s in ['../env','/etc/passwd','x/y','x;id','é']]
        cases += [['--action','evidence','--kind','verification','--release-id','candidate',*extra] for extra in [
            ['--operation-path','/tmp/x.json'], ['--bundle-path','/tmp/x.zip'], ['--nonce','a'*64], ['--kind','audit']]]
        cases += [['--action','status','--kind','verification'], ['--kind','verification'], ['--action','evidence','--kind','audit','--nonce','BAD']]
        for args in cases:
            with self.subTest(args=args):
                r=self.cli(*args); self.assertNotEqual(r.returncode,0); self.assertEqual(r.stdout,'')

    def test_symlinks_hardlinks_special_modes_owner_size_and_schema(self):
        original=self.path.read_bytes()
        mutations=['symlink','hardlink','fifo','writable','owner','oversize','empty','schema','encoding','duplicate']
        for name in mutations:
            with self.subTest(name=name):
                self.path.unlink(missing_ok=True)
                if name=='symlink': self.path.symlink_to('/etc/passwd')
                elif name=='fifo': os.mkfifo(self.path,0o644)
                else:
                    raw={'oversize':b'x'*131073,'empty':b'','schema':b'{"secret":"NO"}',
                         'encoding':original.decode().encode('utf-16'),'duplicate':b'{"x":1,"x":2}'}.get(name,original)
                    self.path.write_bytes(raw); self.path.chmod(0o666 if name=='writable' else 0o644)
                    if name=='owner': shutil.chown(self.path,user='cxadmin')
                    if name=='hardlink': os.link(self.path,self.evidence/'alias')
                r=self.export(); self.assertNotEqual(r.returncode,0); self.assertEqual(r.stdout,'')
                if name=='hardlink': (self.evidence/'alias').unlink()

    def test_audit_export_and_mixed_identity_rejection(self):
        nonce='b'*64
        g.append_recovery_audit(self.evidence, nonce, 'deploy', 'signed', 'origin', 'candidate',
                                'automatic_explicit', 1, '2026-10-19T00:00:00Z',
                                'failure', 'candidate_probe_failed', 'unknown', 'none')
        args=('--action','evidence','--kind','audit','--nonce',nonce)
        r=self.cli(*args); self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(json.loads(r.stdout)['outcome'],'failure')
        p=self.evidence/f'recovery-attempts-{nonce}.jsonl'
        p.write_bytes(p.read_bytes().replace(b'"deploy"',b'"ARBITRARY"'))
        r=self.cli(*args); self.assertNotEqual(r.returncode,0); self.assertEqual(r.stdout,'')

    def test_evidence_directory_symlink_and_state_mode(self):
        self.path.unlink(); self.evidence.rmdir(); self.evidence.symlink_to('/etc')
        try: self.assertNotEqual(self.export().returncode,0)
        finally: self.evidence.unlink(); self.evidence.mkdir(mode=0o755)
        self.state.chmod(0o755)
        try: self.assertNotEqual(self.export().returncode,0)
        finally: self.state.chmod(0o700)


if __name__ == '__main__': unittest.main(verbosity=2)
