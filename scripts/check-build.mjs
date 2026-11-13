import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
await assert.rejects(access(new URL('../dist/map-poc.html', import.meta.url)), { code: 'ENOENT' },
  'the retired standalone PoC entry must not be published')
assert.match(html, /lang="ja"/, 'production HTML should declare Japanese')

const notFoundHtml = await readFile(new URL('../dist/404.html', import.meta.url), 'utf8')
assert.match(notFoundHtml, /<html lang="ja">/, '404 page should declare Japanese')
assert.match(notFoundHtml, /href="\/SfQC\/#\/map"/, '404 page should link back to the learning map')

const assets = [...html.matchAll(/(?:src|href)="(\/SfQC\/assets\/[^"]+)"/g)]
  .map(([, url]) => url)

assert.ok(assets.some((url) => url.endsWith('.js')), 'production JavaScript should use the Pages base path')
assert.ok(assets.some((url) => url.endsWith('.css')), 'production CSS should use the Pages base path')

const assetsDirectory = new URL('../dist/assets/', import.meta.url)
const stylesheets = await Promise.all((await readdir(assetsDirectory, { recursive: true }))
  .filter((file) => /\.css$/u.test(file))
  .map((file) => readFile(new URL(file.replaceAll('\\', '/'), assetsDirectory), 'utf8')))
const javascript = await Promise.all((await readdir(assetsDirectory, { recursive: true }))
  .filter((file) => /\.(?:[cm]?js)$/u.test(file))
  .map((file) => readFile(new URL(file.replaceAll('\\', '/'), assetsDirectory), 'utf8')))
const allJavaScript = javascript.join('\n')
const allStyles = `${stylesheets.join('\n')}\n${allJavaScript}`
const stylesheet = await readFile(new URL(`../dist/${assets.find((url) => url.endsWith('.css')).slice('/SfQC/'.length)}`, import.meta.url), 'utf8')
assert.match(allJavaScript, /map-graph-view/, 'production JavaScript should include the integrated lesson map')
assert.match(allJavaScript, /course-section/, 'production JavaScript should include the published basic statistics course')
assert.match(allJavaScript, /course-practice|ds-practice-question/u, 'production JavaScript should include the five-category practice')
assert.doesNotMatch(allJavaScript, /map-author-editor|分野編集/u, 'production JavaScript must not include the development-only domain editor')
assert.doesNotMatch(allJavaScript, /sfqc-preview=descriptive-statistics|descriptive-statistics-preview-content|別の数値で試す|この考え方を理解できた|比較用モックを開く|一時的な比較用モック|操作中の測定値、平均、各偏差/u,
  'production JavaScript must not include the development-only comparison preview')
assert.match(stylesheet, /react-flow/, 'production CSS should include React Flow styles')
assert.ok(stylesheets.length > 0, 'production assets should include at least one stylesheet')
assert.match(allStyles, /\.course-practice-content/u, 'production CSS should include the course practice layout')
assert.match(allStyles, /\.ds-practice-question/u, 'production CSS should include practice question styles')
assert.match(allStyles, /\.interactive-variance-comparison/u, 'production CSS should include interactive course figures')
assert.doesNotMatch(allStyles, /\.screen-wide-preview|\.descriptive-statistics-preview(?:-content|-exercise|-references)?(?:[\s>{.:,])/u,
  'production CSS must not include development-only comparison preview styles')

await assert.rejects(access(new URL('../dist/preview/', import.meta.url)), { code: 'ENOENT' },
  'the retired comparison preview build must not be published')

for (const url of assets) {
  await access(new URL(`../dist/${url.slice('/SfQC/'.length)}`, import.meta.url))
}

await access(new URL('../dist/third-party-licenses.txt', import.meta.url))
const licenses = await readFile(new URL('../dist/third-party-licenses.txt', import.meta.url), 'utf8')
assert.match(licenses, /@xyflow\/react@12\.12\.0/u, 'production graph dependencies should be listed')
assert.match(licenses, /@dagrejs\/dagre@3\.1\.3/u, 'production graph dependencies should be listed')
assert.match(licenses, /Solarized palette values \(not runtime code or a dependency\)/u, 'the Solarized palette source should be identified')
assert.match(licenses, /https:\/\/github\.com\/altercation\/solarized/u, 'the Solarized source should be linked')
assert.match(licenses, /Copyright \(c\) 2011 Ethan Schoonover/u, 'the Solarized MIT license should be included')
