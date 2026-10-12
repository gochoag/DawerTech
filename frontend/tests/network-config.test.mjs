import assert from 'node:assert/strict';
import test from 'node:test';
import { apiUrl, lanAddresses } from '../scripts/network-config.mjs';

const address = (ip, mac = '00:e0:4c:39:73:50') => ({ address: ip, family: 'IPv4', internal: false, mac });

test('APK chooses the LAN adapter instead of VirtualBox, Hyper-V or VPN', () => {
  const interfaces = {
    'Ethernet 4': [address('192.168.56.1', '0a:00:27:00:00:11')],
    'Ethernet 5': [address('192.168.100.49')],
    'vEthernet (Default Switch)': [address('172.25.16.1')],
    Tailscale: [address('169.254.83.107')],
  };
  assert.deepEqual(lanAddresses(interfaces), ['192.168.100.49']);
  assert.equal(apiUrl({ android: true, env: {}, interfaces }), 'http://192.168.100.49:5000/api/v1');
});

test('APK fails clearly for missing or ambiguous LAN adapters and for localhost', () => {
  assert.throws(() => apiUrl({ android: true, env: {}, interfaces: {} }), /IP de red local/);
  assert.throws(() => apiUrl({ android: true, env: {}, interfaces: { A: [address('10.0.0.5')], B: [address('192.168.1.3')] } }), /varias interfaces/);
  assert.throws(() => apiUrl({ android: true, env: { DAWERTECH_API_URL: 'http://localhost:5000/api/v1' } }), /no localhost/);
});

test('explicit endpoints work and malformed endpoints are rejected', () => {
  assert.equal(apiUrl({ android: true, env: { DAWERTECH_API_URL: 'http://10.0.0.5:5000/api/v1/' }, interfaces: {} }), 'http://10.0.0.5:5000/api/v1');
  for (const value of ['ftp://10.0.0.5/api/v1', 'https://server/api/v1?x=1', 'https://user:pass@server/api/v1', 'https://server/not-api']) {
    assert.throws(() => apiUrl({ env: { DAWERTECH_API_URL: value } }));
  }
});

test('platform environment URLs can differ and support an HTTPS deployment without LAN', () => {
  const env = { DAWERTECH_API_URL: 'http://localhost:5000/api/v1', DAWERTECH_ANDROID_API_URL: 'https://api.example.com/api/v1' };
  assert.equal(apiUrl({ env, interfaces: {} }), 'http://localhost:5000/api/v1');
  assert.equal(apiUrl({ android: true, env, interfaces: {} }), 'https://api.example.com/api/v1');
});
