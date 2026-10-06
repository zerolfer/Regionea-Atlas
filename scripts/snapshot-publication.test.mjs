import { expect, it } from 'vitest'
import * as publication from './lib/snapshot-publication.mjs'

it('publica un archivo aunque Windows bloquee su reemplazo por rename', async () => {
  expect(typeof publication.promoteSnapshotFiles).toBe('function')
  const contents = new Map([['target', 'old'], ['temporary', 'new']])
  const io = {
    readFile: async name => contents.get(name),
    rename: async () => { throw Object.assign(new Error('Watcher lock'), { code: 'EPERM' }) },
    writeFile: async (name, body) => contents.set(name, body),
    unlink: async name => contents.delete(name),
  }
  await publication.promoteSnapshotFiles([{ target: 'target', temporary: 'temporary' }], io)
  expect(contents.get('target')).toBe('new')
  expect(contents.has('temporary')).toBe(false)
})

it('restaura todos los originales si falla una promoción posterior', async () => {
  expect(typeof publication.promoteSnapshotFiles).toBe('function')
  const contents = new Map([['a', 'old-a'], ['b', 'old-b'], ['a.tmp', 'new-a'], ['b.tmp', 'new-b']])
  const io = {
    readFile: async name => contents.get(name),
    rename: async (from, to) => {
      if (to === 'b') throw Object.assign(new Error('Disk error'), { code: 'EIO' })
      contents.set(to, contents.get(from)); contents.delete(from)
    },
    writeFile: async (name, body) => contents.set(name, body),
  }
  await expect(publication.promoteSnapshotFiles([{ target: 'a', temporary: 'a.tmp' }, { target: 'b', temporary: 'b.tmp' }], io)).rejects.toThrow('Disk error')
  expect(contents.get('a')).toBe('old-a')
  expect(contents.get('b')).toBe('old-b')
})
