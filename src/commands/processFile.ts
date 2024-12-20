import { ArgumentsCamelCase, Argv } from 'yargs'
import { isAbsolute, join } from 'path'
import process from 'node:process'
import * as fs from 'node:fs'
import * as readline from 'node:readline'
import { promisify } from 'node:util'
import { processLink } from '../engine'
import * as path from 'node:path'
import { logger } from '../logger'
import { yellow } from 'picocolors'
import { generateMediaPath } from './_shared'

interface ParseArgv {
  ip: string
  op: string
}

export const command = 'processFile <ip> <op>'
export const describe = 'Parse a given target string into corresponding component values.'
export const aliases = ['p']

export function builder(yargs: Argv<ParseArgv>): Argv {
  return yargs
    .positional('ip', {
      type: 'string',
      description: 'Path to inputFile',
      requiresArg: true,
    })
    .coerce('ip', (value: string) => {
      if (isAbsolute(value)) {
        return value
      }
      return join(process.cwd(), value)
    })
    .positional('op', {
      type: 'string',
      description: 'Path to outputFile',
      requiresArg: true,
    })
    .coerce('op', (value: string) => {
      if (isAbsolute(value)) {
        return value
      }
      return join(process.cwd(), value)
    })
}

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)
const symlink = promisify(fs.symlink)

// const readdir = promisify(fs.readdir)

export async function handlerO(argv: ArgumentsCamelCase<ParseArgv>) {
  const { ip } = argv
  const entries = await readdir(ip)
  for (const parent of entries) {
    const parentPath = path.join(ip, parent)
    const parentStats = await stat(`${ip}/${parent}`)
    if (parentStats.isFile()) {
      continue
    }
    const parentDetails = processLink(parent)
    const children = await readdir(`${ip}/${parent}`)
    for (const child of children) {
      const childPath = path.join(parentPath, child)
      const childStats = await stat(`${ip}/${parent}/${child}`)
      if (childStats.isFile()) {
        const pathName = generateMediaPath(parentDetails, child)
        await symlink(childPath, pathName)
      }
    }
  }
}

export async function handler(argv: ArgumentsCamelCase<ParseArgv>) {
  const { ip, op } = argv
  const fileStream = fs.createReadStream(ip)
  const ipRl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })
  const opFp = await promisify(fs.open)(op, 'w+')

  for await (const line of ipRl) {
    const [parent, child] = line.split('/')
    if (!parent || !child) {
      logger.warn(yellow('skipping ' + line))
      continue
    }
    fs.writeSync(opFp, `${generateMediaPath(processLink(parent), child)}\n`)
  }
  fs.closeSync(opFp)
  fileStream.close()
}
