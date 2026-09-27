import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE = path.join(ROOT, 'content', 'territories')
const TARGET = path.join(ROOT, 'public', 'data', 'atlas', 'editorial.json')

function parseDocument(raw, filename) {
  const [frontmatterBlock = '', ...bodyParts] = raw.replace(/^---\s*/, '').split(/\n---\s*\n/)
  const frontmatter = Object.fromEntries(
    frontmatterBlock
      .split('\n')
      .map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
  )
  const body = bodyParts.join('\n---\n').trim()
  const sections = []
  let current = null
  for (const block of body.split(/\n{2,}/)) {
    if (block.startsWith('## ')) {
      current = { title: block.slice(3).trim(), paragraphs: [] }
      sections.push(current)
    } else if (block.trim()) {
      if (!current) {
        current = { title: 'Contexto', paragraphs: [] }
        sections.push(current)
      }
      current.paragraphs.push(block.replace(/\n/g, ' ').trim())
    }
  }
  return {
    id: frontmatter.id || path.basename(filename, '.md'),
    title: frontmatter.title || frontmatter.id,
    kicker: frontmatter.kicker || '',
    summary: frontmatter.summary || '',
    sections,
  }
}

async function main() {
  const files = (await readdir(SOURCE)).filter((file) => file.endsWith('.md')).sort()
  const entries = {}
  for (const file of files) {
    const entry = parseDocument(await readFile(path.join(SOURCE, file), 'utf8'), file)
    entries[entry.id] = entry
  }
  await mkdir(path.dirname(TARGET), { recursive: true })
  await writeFile(TARGET, `${JSON.stringify(entries)}\n`, 'utf8')
  process.stdout.write(`Contenido editorial: ${files.length} fichas.\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
