import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

const html = await readFile(new URL('../dist/preview/index.html', import.meta.url), 'utf8')
assert.match(html, /lang="ja"/u, 'public preview HTML should declare Japanese')
const assets = [...html.matchAll(/(?:src|href)="(\/SfQC\/preview\/assets\/[^"]+)"/gu)].map(([, url]) => url)
assert.ok(assets.some((url) => url.endsWith('.js')), 'public preview JavaScript should use its Pages base path')
assert.ok(assets.some((url) => url.endsWith('.css')), 'public preview CSS should use its Pages base path')

const assetsDirectory = new URL('../dist/preview/assets/', import.meta.url)
const files = await readdir(assetsDirectory, { recursive: true })
const javascript = await Promise.all(files.filter((file) => /\.(?:[cm]?js)$/u.test(file))
  .map((file) => readFile(new URL(file.replaceAll('\\', '/'), assetsDirectory), 'utf8')))
const bundle = javascript.join('\n')
assert.match(bundle, /sfqc-preview=descriptive-statistics/u, 'public preview should include its direct-entry route')
assert.match(bundle, /descriptive-statistics-preview/u, 'public preview should include the mock')
assert.match(bundle, /interactive-variance-comparison/u, 'public preview should include the interactive figure')
assert.doesNotMatch(bundle, /map-author-editor|分野編集/u, 'public preview must not enable the development-only author editor')
assert.match(bundle, /\.descriptive-statistics-preview-exercise\{/u, 'public preview should include its inline mock styles')
assert.match(bundle, /\.interactive-variance-comparison\{/u, 'public preview should include its inline figure styles')

for (const url of assets) await access(new URL(`../dist/preview/${url.slice('/SfQC/preview/'.length)}`, import.meta.url))
await access(new URL('../dist/preview/third-party-licenses.txt', import.meta.url))
