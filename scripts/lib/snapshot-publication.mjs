import * as fs from 'node:fs/promises'

// Recoverable local publication, not a multi-file atomic store. Windows may
// deny rename while a watcher reads; deployment must use the validated result.
export async function promoteSnapshotFiles(files, io = fs) {
  const originals = await Promise.all(files.map(file => io.readFile(file.target)))
  try {
    for (const { temporary, target } of files) {
      try { await io.rename(temporary, target) }
      catch (error) {
        if (!['EPERM', 'EBUSY'].includes(error.code)) throw error
        await io.writeFile(target, await io.readFile(temporary))
        await io.unlink(temporary)
      }
    }
  } catch (error) {
    await Promise.all(files.map((file, index) => io.writeFile(file.target, originals[index])))
    throw error
  }
}
