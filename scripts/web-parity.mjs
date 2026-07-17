/**
 * InventExpert (mobile) → inventexpert-web
 *
 * Atalhos a partir do app mobile:
 *   node scripts/web-parity.mjs sync    # copia módulos compartilhados + valida
 *   node scripts/web-parity.mjs check   # só verifica divergência
 *
 * Env:
 *   INVENTEXPERT_WEB_ROOT  caminho do repo web (default: ../inventexpert-web)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const cmd = process.argv[2] || 'check'

function resolveWebRoot() {
  if (process.env.INVENTEXPERT_WEB_ROOT) {
    return path.resolve(process.env.INVENTEXPERT_WEB_ROOT)
  }
  const candidates = [
    path.resolve(mobileRoot, '../inventexpert-web'),
    path.resolve(mobileRoot, '../InventExpert-web'),
    path.resolve(mobileRoot, 'inventexpert-web'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'scripts', 'parity.mjs'))) return c
  }
  return candidates[0]
}

const webRoot = resolveWebRoot()
const parityScript = path.join(webRoot, 'scripts', 'parity.mjs')

if (!fs.existsSync(parityScript)) {
  console.error(
    `[web-parity] inventexpert-web não encontrado em:\n  ${webRoot}\n` +
      `Clone o repo irmão ou defina INVENTEXPERT_WEB_ROOT.`,
  )
  process.exit(1)
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const scriptName = cmd === 'sync' ? 'parity:sync' : 'parity:check'

console.log(`[web-parity] mobile: ${mobileRoot}`)
console.log(`[web-parity] web:    ${webRoot}`)
console.log(`[web-parity] → npm run ${scriptName}`)

const result = spawnSync(npmCmd, ['run', scriptName], {
  cwd: webRoot,
  env: {
    ...process.env,
    INVENTEXPERT_MOBILE_ROOT: mobileRoot,
    PARITY_STRICT: '1',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (cmd === 'sync') {
  console.log('[web-parity] sugerido na pasta web: npm test && npm run smoke:eval')
}

process.exit(0)
