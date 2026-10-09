"""Private release storage and the existing India Development API adapter."""
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

ROOT = Path(os.environ['CAPITALOS_RELEASE_DIR']).resolve()
ORG = '60088793510'


def save(name, data):
    p = (ROOT / name).resolve()
    if not p.is_relative_to(ROOT):
        raise RuntimeError('Evidence path escapes release directory')
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    p.write_text(json.dumps(data, indent=2))
    p.chmod(0o600)


class Catalyst:
    def __init__(self):
        self.token = os.environ.get('CATALYST_ACCESS_TOKEN', '')
        if not self.token:
            # Use the installed CLI's credential refresh; never print credentials.
            base = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()
            js = """const base=process.argv[1]+'/zcatalyst-cli/lib/';
const S=require(base+'util_modules/config-store.js').default;
const C=require(base+'authentication/credential.js').default;
const dc=require(base+'util_modules/dc.js').getActiveDC();
C.init(S.get(dc+'.credential'));
C.getAccessToken().then(t=>process.stdout.write(t)).catch(()=>process.exit(1));"""
            result = subprocess.run(['node', '-e', js, base, '--', '--dc', 'in'],
                                    capture_output=True, text=True, cwd='/tmp')
            if result.returncode:
                raise RuntimeError('Catalyst authentication unavailable; run catalyst login --dc in')
            self.token = result.stdout.strip()
        if not self.token or '\n' in self.token:
            raise RuntimeError('Invalid Catalyst access token')

    def request(self, path, method='GET', body=None, full=False):
        request = urllib.request.Request(
            'https://api.catalyst.zoho.in/baas/v1' + path, method=method,
            headers={'Authorization': 'Zoho-oauthtoken ' + self.token,
                     'Content-Type': 'application/json', 'CATALYST-ORG': ORG,
                     'Accept': 'application/vnd.catalyst.v2+json',
                     'Environment': 'Development', 'X-CATALYST-Environment': 'Development'},
            data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            save('last-api-error.json', {'path': path, 'method': method,
                                        'http': error.code, 'body': error.read().decode()})
            raise RuntimeError(f'{method} {path}: HTTP {error.code}; private log saved') from None
        if result.get('status') != 'success':
            raise RuntimeError(f'Unsuccessful {method} {path}')
        return result if full else result['data']
