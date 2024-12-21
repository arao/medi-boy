import { ArgumentsCamelCase, Argv } from 'yargs'
import { logger } from '../logger'
import { green } from 'picocolors'
import { processLink } from '../engine'
import { generateMediaPath } from './_shared'

interface ParseArgv {
  target: string
}

export const command = 'parse <target>'
export const describe = 'Parse a given target string into corresponding component values.'
export const aliases = ['p']

export function builder(yargs: Argv<ParseArgv>): Argv {
  return yargs.positional('target', {
    type: 'string',
    description: 'path to sample string',
    requiresArg: true,
  })
}

export async function handler(argv: ArgumentsCamelCase<ParseArgv>) {
  const { target } = argv
  const [parent, child] = target.split('/')
  const parentDetails = parent ? processLink(parent) : undefined
  const childDetails = child ? processLink(child) : undefined
  logger.box(green('PARENT =>' + parent))
  logger.box(green(JSON.stringify(parentDetails, null, 2)))
  logger.box(green('CHILD =>' + child))
  logger.box(green(JSON.stringify(childDetails, null, 2)))
  child && parentDetails && logger.box(green(JSON.stringify(generateMediaPath(parentDetails, child), null, 2)))
}

// generateMediaPath(
//   processLink('www.1TamilBlasters.dad - The Heist (2024) [Hindi - 1080p HQ HD AVC - x264 - [DDP5.1(192Kbps) + AAC] - 4.1GB - ESub]'),
//   'www.1TamilBlasters.dad - The Heist (2024) [Hindi - 1080p HQ HD AVC - x264 - [DDP5.1(192Kbps) + AAC] - 4.1GB - ESub].mkv');
