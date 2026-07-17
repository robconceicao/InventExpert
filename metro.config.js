/**
 * Metro — shims de módulos nativos no web (GitHub Pages / expo export -p web).
 * Evita crash: TurboModuleRegistry.getEnforcing('RNShare') etc.
 */
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const WEB_SHIMS = {
  "react-native-share": path.resolve(
    __dirname,
    "src/shims/react-native-share.web.js",
  ),
  "react-native-document-scanner-plugin": path.resolve(
    __dirname,
    "src/shims/document-scanner.web.js",
  ),
};

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return {
      filePath: WEB_SHIMS[moduleName],
      type: "sourceFile",
    };
  }
  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
