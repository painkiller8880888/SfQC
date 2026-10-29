import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
await assert.rejects(access(new URL('../dist/map-poc.html', import.meta.url)), { code: 'ENOENT' },
  'the development-only map PoC must not be published')
assert.match(html, /lang="ja"/, 'production HTML should declare Japanese')

const notFoundHtml = await readFile(new URL('../dist/404.html', import.meta.url), 'utf8')
assert.match(notFoundHtml, /<html lang="ja">/, '404 page should declare Japanese')
assert.match(notFoundHtml, /href="\/SfQC\/#\/map"/, '404 page should link back to the learning map')

const assets = [...html.matchAll(/(?:src|href)="(\/SfQC\/assets\/[^"]+)"/g)]
  .map(([, url]) => url)

assert.ok(assets.some((url) => url.endsWith('.js')), 'production JavaScript should use the Pages base path')
assert.ok(assets.some((url) => url.endsWith('.css')), 'production CSS should use the Pages base path')

for (const url of assets) {
  await access(new URL(`../dist/${url.slice('/SfQC/'.length)}`, import.meta.url))
}

await access(new URL('../dist/third-party-licenses.txt', import.meta.url))
