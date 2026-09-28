// Build configuration only. Never read a user, request header or stored preference.
function licenseBuildConfig(env) {
  const appEnvironment = env.APP_ENV || 'production';
  const flag = env.TEST_LICENSE_BYPASS || 'false';
  if (!['production', 'homologation'].includes(appEnvironment)) throw new Error('APP_ENV must be production or homologation');
  if (!['true', 'false'].includes(flag)) throw new Error('TEST_LICENSE_BYPASS must be true or false');
  if (flag === 'true' && (appEnvironment !== 'homologation' || env.EAS_BUILD_PROFILE === 'production')) {
    throw new Error('TEST_LICENSE_BYPASS is forbidden in a production build');
  }
  return { appEnvironment, testLicenseBypass: flag === 'true' && appEnvironment === 'homologation' };
}
module.exports = { licenseBuildConfig };
