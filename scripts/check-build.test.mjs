import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('check-build rejects development-only JavaScript and CSS markers', async () => {
  const fixtureDirectory = await mkdtemp(fileURLToPath(new URL('../dist/assets/.check-build-', import.meta.url)))
  let stylesheetPath
  let originalStylesheet

  try {
    const distDirectory = fileURLToPath(new URL('../dist', import.meta.url))
    const html = await readFile(join(distDirectory, 'index.html'), 'utf8')
    const cssUrl = [...html.matchAll(/href="(\/SfQC\/assets\/[^"]+\.css)"/gu)][0]?.[1]
    assert.ok(cssUrl, 'production HTML should reference a stylesheet')
    stylesheetPath = join(distDirectory, cssUrl.slice('/SfQC/'.length))
    originalStylesheet = await readFile(stylesheetPath, 'utf8')

    const nestedDirectory = join(fixtureDirectory, 'nested')
    await mkdir(nestedDirectory)
    for (const [marker, message] of [
      ['map-author-editor', /production JavaScript must not include the development-only domain editor/u],
      ['sfqc-preview=descriptive-statistics', /production JavaScript must not include the development-only comparison preview/u],
      ['descriptive-statistics-exercise-preview', /production JavaScript must not include the development-only comparison preview/u],
      ['この考え方を理解できた', /production JavaScript must not include the development-only comparison preview/u],
    ]) {
      await writeFile(join(nestedDirectory, 'chunk.js'), marker)
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-build.mjs', import.meta.url))], {
        encoding: 'utf8',
      })
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, message)
    }

    await writeFile(join(nestedDirectory, 'chunk.js'), 'safe')
    for (const marker of ['.interactive-variance-comparison{padding:0}', '.descriptive-statistics-preview-exercise{padding:0}', '.ds-practice-question{padding:0}']) {
      await writeFile(join(nestedDirectory, 'preview.css'), marker)
      const cssResult = spawnSync(process.execPath, [fileURLToPath(new URL('./check-build.mjs', import.meta.url))], {
        encoding: 'utf8',
      })
      assert.notEqual(cssResult.status, 0)
      assert.match(cssResult.stderr, /production CSS must not include development-only comparison preview styles/u)
    }
  } finally {
    if (stylesheetPath && originalStylesheet !== undefined) await writeFile(stylesheetPath, originalStylesheet)
    await rm(fixtureDirectory, { recursive: true, force: true })
  }
})
