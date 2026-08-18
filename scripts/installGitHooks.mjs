import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const projectRoot = path.resolve(import.meta.dirname, '..')

// Installing dependencies from an archive may happen outside a Git checkout.
// In that case there is nowhere to register the repository-local hooks.
if (process.env.CI !== 'true' && existsSync(path.join(projectRoot, '.git'))) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
  } catch {
    globalThis.console.warn(
      'Could not install Git hooks automatically; run npm run prepare to retry.',
    )
  }
}
