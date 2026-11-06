import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('check-build rejects development-only markers in nested JavaScript chunks', async () => {
  const fixtureDirectory = await mkdtemp(fileURLToPath(new URL('../dist/assets/.check-build-', import.meta.url)))

  try {
    const nestedDirectory = join(fixtureDirectory, 'nested')
    await mkdir(nestedDirectory)
    for (const [marker, message] of [
      ['map-author-editor', /production JavaScript must not include the development-only domain editor/u],
      ['sfqc-preview=descriptive-statistics', /production JavaScript must not include the development-only comparison preview/u],
    ]) {
      await writeFile(join(nestedDirectory, 'chunk.js'), marker)
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-build.mjs', import.meta.url))], {
        encoding: 'utf8',
      })
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, message)
    }
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true })
  }
})
