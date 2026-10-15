#!/usr/bin/env python3
"""Export a successfully deployed internal staging ZIP; promote those exact bytes."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import urllib.request
import zipfile

FRONTENDS = ['dashboard', 'internal-surveys/b2b', 'internal-surveys/installation', 'public/mystery-shopper']
REQUIRED = {'release/backend/app/core/analytics_scope.py', 'release/backend/app/routers/analytics.py'} | {'release/frontends/'+name+'/dist/index.html' for name in FRONTENDS}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def api_run(run_id):
    require(str(run_id).isdigit(), 'Invalid run identifier')
    repo = os.environ.get('GITHUB_REPOSITORY', '')
    require(repo == 'GregoryPana/b2b-cx-platform', 'Unexpected repository')
    request = urllib.request.Request('https://api.github.com/repos/'+repo+'/actions/runs/'+str(run_id), headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'], 'Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def staging_run(run_id):
    run = api_run(run_id)
    require(run.get('status') == 'completed' and run.get('conclusion') == 'success', 'Staging deployment is not successful')
    require(run.get('path') == '.github/workflows/deploy-staging.yml' and run.get('head_branch') == 'main', 'Wrong staging workflow/branch')
    require(re.fullmatch(r'[0-9a-f]{40}', run.get('head_sha','')), 'Invalid source revision')
    return run


def archive_files(bundle):
    require(bundle.is_file() and not bundle.is_symlink(), 'Bundle must be a regular file')
    with zipfile.ZipFile(bundle) as archive:
        names = [entry.filename for entry in archive.infolist()]
        require(len(names) == len(set(names)), 'Duplicate archive entry')
        require(len(names) <= 10000 and sum(e.file_size for e in archive.infolist()) <= 256*1024*1024, 'Release archive exceeds bounded size')
        require(REQUIRED.issubset(names), 'Missing required release payload')
        result = {}
        for entry in archive.infolist():
            path = PurePosixPath(entry.filename)
            require(not path.is_absolute() and '..' not in path.parts and path.parts[0] == 'release' and '\\' not in entry.filename, 'Unsafe archive path')
            if entry.is_dir(): continue
            mode = entry.external_attr >> 16
            require(stat.S_IFMT(mode) in (0, stat.S_IFREG), 'Non-regular archive payload')
            require(path.name != '.env' and path.suffix != '.key', 'Runtime secret in release archive')
            require(entry.file_size <= 64*1024*1024, 'Oversized archive member')
            result[entry.filename] = archive.read(entry)
        return result


def export_release(run_id, checkout, runtime, out):
    run = staging_run(run_id)
    bundle = runtime/'releases'/('cwscx-release-staging-'+str(run['run_number'])+'-'+run['head_sha']+'.zip')
    files = archive_files(bundle)
    python_count = frontend_count = 0
    for name, data in files.items():
        if name.startswith('release/backend/') and name.endswith('.py'):
            relative = name.removeprefix('release/')
            require((checkout/relative).read_bytes() == data, 'Current backend/migration source differs from validated release')
            require((runtime/relative).read_bytes() == data, 'Installed backend/migration differs from release archive')
            python_count += 1
        elif name.startswith('release/frontends/'):
            relative = name.removeprefix('release/frontends/')
            require((runtime/'frontends-src'/relative).read_bytes() == data, 'Installed frontend differs from release archive')
            frontend_count += 1
    require(python_count > 0 and frontend_count >= len(FRONTENDS), 'Empty validation population')
    out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(bundle, out/'cwscx-release.zip')
    receipt = {'source_sha':run['head_sha'], 'staging_deployment_run':int(run_id), 'staging_run_number':run['run_number'], 'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(), 'validated_python_files':python_count, 'validated_frontend_files':frontend_count}
    (out/'release.json').write_text(json.dumps(receipt, indent=2))
    return receipt


def validate_release(bundle, receipt_path, expected_sha, source_sha, producer_run):
    require(re.fullmatch(r'[0-9a-f]{64}',expected_sha) and re.fullmatch(r'[0-9a-f]{40}',source_sha), 'Invalid expected identity')
    producer = api_run(producer_run)
    require(producer.get('path') == '.github/workflows/export-validated-staging.yml' and producer.get('conclusion') == 'success' and producer.get('head_branch') == 'main', 'Unapproved artifact producer')
    require(receipt_path.is_file() and not receipt_path.is_symlink(), 'Invalid receipt file')
    receipt = json.loads(receipt_path.read_text())
    require(receipt.get('sha256') == expected_sha and receipt.get('source_sha') == source_sha, 'Receipt identity mismatch')
    run = staging_run(receipt['staging_deployment_run'])
    require(run['head_sha'] == source_sha, 'Staging run source mismatch')
    require(hashlib.sha256(bundle.read_bytes()).hexdigest() == expected_sha, 'Bundle digest mismatch')
    archive_files(bundle)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='mode',required=True)
    export = sub.add_parser('export')
    export.add_argument('--run',required=True)
    export.add_argument('--out',required=True,type=Path)
    validate = sub.add_parser('validate')
    for name in ['bundle','receipt','sha','source','producer']:
        validate.add_argument('--'+name,required=True)
    args = parser.parse_args()
    if args.mode == 'export':
        result = export_release(args.run,Path.cwd(),Path('/opt/cwscx'),args.out)
    else:
        result = validate_release(Path(args.bundle),Path(args.receipt),args.sha,args.source,args.producer)
    print(json.dumps(result,indent=2))
