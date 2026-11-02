import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('check-build rejects forbidden markers in nested JavaScript chunks', async () => {
  const fixtureDirectory = await mkdtemp(fileURLToPath(new URL('../dist/assets/.check-build-', import.meta.url)))

  try {
    const nestedDirectory = join(fixtureDirectory, 'nested')
    await mkdir(nestedDirectory)
    await writeFile(join(nestedDirectory, 'chunk.js'), 'map-author-editor')

    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-build.mjs', import.meta.url))], {
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /production JavaScript must not include the development-only domain editor/u)
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true })
  }
})
