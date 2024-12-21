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
  symlink: boolean
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
    .option('symlink', {
      alias: 'sm',
      type: 'boolean',
      description: 'Process dir and create sym links',
      default: false,
    })
}

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)
const symlink = promisify(fs.symlink)
const mkdir = promisify(fs.mkdir)

async function processDirSymlink(argv: ArgumentsCamelCase<ParseArgv>) {
  const { ip, op } = argv
  logger.info(`Processing dir ${ip} linking to ${op}`, argv)
  const entries = await readdir(ip)
  for (const parent of entries) {
    const parentPath = path.join(ip, parent)
    const parentStats = await stat(`${ip}/${parent}`)
    if (parentStats.isFile()) {
      continue
    }
    const allChildren = await readdir(`${ip}/${parent}`)
    const cleanedChildren = []
    const childrenPaths: string[] = []
    // const childPath = path.join(parentPath, child)
    for (const child of allChildren) {
      const childStats = await stat(`${ip}/${parent}/${child}`)
      if (childStats.isFile()) {
        cleanedChildren.push(child)
        childrenPaths.push(path.join(parentPath, child))
      }
    }
    const generatedPaths = processDir(parent, cleanedChildren)
    for (let index = 0; index < generatedPaths.length; index++) {
      const linkPath = path.join(op, generatedPaths[index]!)
      const likDir = path.dirname(linkPath)
      if (!fs.existsSync(likDir)) {
        await mkdir(likDir, { recursive: true })
      }
      await symlink(childrenPaths[index]!, path.join(op, generatedPaths[index]!))
    }
  }
}

export async function handler(argv: ArgumentsCamelCase<ParseArgv>) {
  if (argv.symlink) {
    await processDirSymlink(argv)
  } else {
    await processFileContent(argv)
  }
}

async function processFileContent(argv: ArgumentsCamelCase<ParseArgv>) {
  const { ip, op } = argv
  logger.info(`Processing file ${ip} to ${op}`)
  const fileStream = fs.createReadStream(ip)
  const ipRl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })
  const opFp = await promisify(fs.open)(op, 'w+')
  let prevParent: string | undefined = undefined
  let childBuffer: string[] = []
  for await (const line of ipRl) {
    const [parent, child] = line.split('/')
    if (!parent || !child) {
      logger.warn(yellow('skipping ' + line))
      continue
    }
    if (prevParent != parent) {
      // execute buffer
      if (prevParent) {
        processDir(prevParent, childBuffer).forEach((line) => {
          fs.writeSync(opFp, `${line}\n`)
        })
      }
      prevParent = parent
      childBuffer = [child]
    } else {
      childBuffer.push(child)
    }
  }
  if (prevParent && childBuffer.length > 0) {
    processDir(prevParent, childBuffer).forEach((line) => {
      fs.writeSync(opFp, `${line}\n`)
    })
  }
  fs.closeSync(opFp)
  fileStream.close()
}

function processDir(parent: string, children: string[]): string[] {
  const parentDetails = processLink(parent)
  const titleBuffer = []
  const categoryBuffer = []
  const mediaDetails = []
  for (const child of children) {
    const pathDetails = generateMediaPath(parentDetails, child)
    titleBuffer.push(pathDetails.title)
    categoryBuffer.push(pathDetails.category)
    mediaDetails.push(pathDetails)
  }
  const finalTitle = selectOnFrequency(titleBuffer)
  const finalCategory = selectOnFrequency(categoryBuffer)
  if (finalTitle == '' || finalCategory == '') {
    logger.warn(yellow(`skipping ${parent} as not able to extract title or category, extracted ${finalCategory} ${finalTitle}`))
    return []
  }
  return mediaDetails.map((mediaDetail) => {
    return `${finalCategory}/${finalTitle}${mediaDetail.intermediatePath}/${mediaDetail.child}`
  })
}

function selectOnFrequency(buffer: string[]) {
  const occurrenceMap: Record<string, number> = buffer.reduce(
    (agg, curr) => {
      agg[curr] = (agg[curr] || 0) + 1
      return agg
    },
    {} as Record<string, number>,
  )
  return (
    Object.entries(occurrenceMap)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .map((i) => i[0])?.[0] ?? ''
  )
}
