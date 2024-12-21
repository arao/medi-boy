import yargs, { CommandModule } from 'yargs'
import { config } from 'dotenv'
import { commands } from '../src'
import { bgBlue } from 'picocolors'

config()

const run = yargs(process.argv.slice(2))
run.usage(bgBlue(`Medi boy organise media`))
for (const command of commands) {
  run.command(command as unknown as CommandModule)
}

run.demandCommand(1, 'You need at least one command before moving on').help().argv
