const { test } = require('node:test');
const assert = require('node:assert/strict');
const { licenseBuildConfig } = require('./license-build-config.cjs');
test('license required by default and when explicitly false', () => {
  assert.equal(licenseBuildConfig({}).testLicenseBypass, false);
  assert.equal(licenseBuildConfig({ APP_ENV:'homologation', TEST_LICENSE_BYPASS:'false' }).testLicenseBypass, false);
});
test('explicit homologation allows bypass', () => {
  assert.equal(licenseBuildConfig({ APP_ENV:'homologation', TEST_LICENSE_BYPASS:'true' }).testLicenseBypass, true);
});
test('production, missing environment and invalid values cannot enable bypass', () => {
  for (const env of [{TEST_LICENSE_BYPASS:'true'}, {APP_ENV:'production', TEST_LICENSE_BYPASS:'true'}, {APP_ENV:'homologation', TEST_LICENSE_BYPASS:'true', EAS_BUILD_PROFILE:'production'}, {APP_ENV:'homologation',TEST_LICENSE_BYPASS:'1'}, {APP_ENV:'unknown'}]) assert.throws(() => licenseBuildConfig(env));
});
