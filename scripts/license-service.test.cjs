const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function service(bypass) {
  let requests = 0, writes = 0;
  const storage = { getItem: async () => null, setItem: async () => { writes++; }, removeItem: async () => { writes++; } };
  const dependencies = {
    './licenseBuild': { testLicenseBypass: bypass },
    '@react-native-async-storage/async-storage': storage,
    '@supabase/supabase-js': { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) },
    'react-native': { Platform: { OS: 'android' } },
  };
  const file = ['src/services/tadeuLicense.ts', 'src/lib/tadeuLicense.ts', 'services/tadeuLicense.ts'].find(f => fs.existsSync(path.join(__dirname, '..', f)));
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replaceAll('import.meta.env', '({})');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const context = { exports: {}, require: (name) => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; }, process: { env: {} }, fetch: () => { requests++; throw Error('unexpected network'); }, localStorage: { getItem: () => null, setItem: () => { writes++; }, removeItem: () => { writes++; } } };
  vm.runInNewContext(compiled, context);
  const api = context.exports;
  return { fetch: api.fetchTadeuLicense || api.buscarLicencaTadeu || api.fetchLicense, feature: api.hasLicensedFeature || api.temFeature || api.hasFeature, limit: api.getLicensedLimit || api.limiteFeature || api.featureLimit, requests: () => requests, writes: () => writes };
}
test('homologation enters without commercial auth, network or persistent grant', async () => {
  const s = service(true);
  const result = await s.fetch();
  assert.equal(result.plan, 'homologation');
  assert.equal(s.feature(result, 'paid_feature'), true);
  assert.equal(s.limit(result, 'quota'), null);
  assert.equal(s.requests(), 0);
  assert.equal(s.writes(), 0);
});
test('production requires commercial auth and cannot trust a user-supplied test plan', async () => {
  const s = service(false);
  await assert.rejects(s.fetch(), /TADEU_AUTH_REQUIRED/);
  assert.equal(s.feature({plan:'homologation', features:[]}, 'paid_feature'), false);
});
