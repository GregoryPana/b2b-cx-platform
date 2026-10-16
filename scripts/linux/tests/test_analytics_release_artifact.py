import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

spec = importlib.util.spec_from_file_location('artifact', Path(__file__).resolve().parents[1]/'analytics_release_artifact.py')
if spec is None or spec.loader is None: raise RuntimeError('Missing artifact module')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.checkout, self.runtime = self.root/'checkout', self.root/'runtime'
        self.checkout.mkdir()
        (self.runtime/'releases').mkdir(parents=True)
        self.source = 'a'*40
        self.stage_record = {'id':101,'run_number':5,'head_sha':self.source,'head_branch':'main','path':'.github/workflows/deploy-staging.yml','status':'completed','conclusion':'success'}
        self.producer = {'id':202,'head_branch':'main','path':'.github/workflows/export-validated-staging.yml','status':'completed','conclusion':'success'}
        self.files = {name:('fixture '+name).encode() for name in m.REQUIRED}
        for name,data in self.files.items():
            if name.startswith('release/backend/'):
                for base in [self.checkout,self.runtime]:
                    p = base/name.removeprefix('release/')
                    p.parent.mkdir(parents=True,exist_ok=True)
                    p.write_bytes(data)
            else:
                p = self.runtime/'frontends-src'/name.removeprefix('release/frontends/')
                p.parent.mkdir(parents=True,exist_ok=True)
                p.write_bytes(data)
        self.bundle = self.runtime/'releases'/('cwscx-release-staging-5-'+self.source+'.zip')
        with zipfile.ZipFile(self.bundle,'w') as archive:
            for name,data in self.files.items():archive.writestr(name,data)
        self.out = self.root/'export'
        p=patch.object(m,'api_run',side_effect=lambda run:self.producer if str(run)=='202' else self.stage_record)
        p.start()
        self.addCleanup(p.stop)

    def test_exact_bytes_export_and_provenance_validate(self):
        receipt=m.export_release(101,self.checkout,self.runtime,self.out)
        self.assertEqual(self.bundle.read_bytes(),(self.out/'cwscx-release.zip').read_bytes())
        verified=m.validate_release(self.out/'cwscx-release.zip',self.out/'release.json',receipt['sha256'],self.source,202)
        self.assertEqual(verified['staging_deployment_run'],101)

    def test_failed_or_wrong_workflow_not_exported(self):
        for field,value in [('conclusion','failure'),('path','.github/workflows/deploy-mystery-public.yml'),('head_branch','other')]:
            with self.subTest(field=field):
                original=self.stage_record[field]
                self.stage_record[field]=value
                with self.assertRaises(ValueError):m.export_release(101,self.checkout,self.runtime,self.out)
                self.assertFalse(self.out.exists())
                self.stage_record[field]=original

    def test_source_or_installed_drift_rejected(self):
        name='backend/app/core/analytics_scope.py'
        for base in [self.checkout,self.runtime]:
            with self.subTest(base=base.name):
                original=(base/name).read_bytes()
                (base/name).write_bytes(b'changed')
                with self.assertRaises(ValueError):m.export_release(101,self.checkout,self.runtime,self.out)
                (base/name).write_bytes(original)

    def test_frontend_drift_rejected(self):
        (self.runtime/'frontends-src/dashboard/dist/index.html').write_bytes(b'drift')
        with self.assertRaisesRegex(ValueError,'frontend differs'):
            m.export_release(101,self.checkout,self.runtime,self.out)

    def test_tampered_promoted_bundle_rejected(self):
        receipt=m.export_release(101,self.checkout,self.runtime,self.out)
        with (self.out/'cwscx-release.zip').open('ab') as output:output.write(b'tampered')
        with self.assertRaisesRegex(ValueError,'digest mismatch'):
            m.validate_release(self.out/'cwscx-release.zip',self.out/'release.json',receipt['sha256'],self.source,202)

    def test_wrong_receipt_or_producer_rejected(self):
        receipt=m.export_release(101,self.checkout,self.runtime,self.out)
        self.producer['path']='.github/workflows/deploy-mystery-public.yml'
        with self.assertRaisesRegex(ValueError,'producer'):
            m.validate_release(self.out/'cwscx-release.zip',self.out/'release.json',receipt['sha256'],self.source,202)
        self.producer['path']='.github/workflows/export-validated-staging.yml'
        with self.assertRaisesRegex(ValueError,'identity mismatch'):
            m.validate_release(self.out/'cwscx-release.zip',self.out/'release.json',receipt['sha256'],'b'*40,202)

    def test_unsafe_or_duplicate_archive_rejected(self):
        original=self.bundle.read_bytes()
        for name in ['../escape','release/../../escape','release/backend/.env','release/backend/private.key']:
            with self.subTest(name=name):
                self.bundle.write_bytes(original)
                with zipfile.ZipFile(self.bundle,'a') as archive:archive.writestr(name,b'invalid-fixture')
                with self.assertRaises(ValueError):m.archive_files(self.bundle)
        self.bundle.write_bytes(original)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning)
            with zipfile.ZipFile(self.bundle,'a') as archive:archive.writestr(next(iter(m.REQUIRED)),b'duplicate')
        with self.assertRaisesRegex(ValueError,'Duplicate'):m.archive_files(self.bundle)

    def test_symlink_archive_entry_rejected(self):
        entry=zipfile.ZipInfo('release/backend/symlink')
        entry.create_system=3
        entry.external_attr=(0o120777<<16)
        with zipfile.ZipFile(self.bundle,'a') as archive:archive.writestr(entry,'outside')
        with self.assertRaisesRegex(ValueError,'Non-regular'):m.archive_files(self.bundle)


if __name__=='__main__':unittest.main()
