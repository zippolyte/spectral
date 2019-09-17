#!/usr/bin/env node

import * as yargs from 'yargs';

import lintCommand from './commands/lint';
import serveCommand from './commands/serve';

export default yargs
  .scriptName('spectral')
  .parserConfiguration({
    'camel-case-expansion': true,
  })
  .version()
  .help(true)
  .strict()
  .wrap(yargs.terminalWidth())
  .command(lintCommand)
  .command(serveCommand)
  .demandCommand(1, '').argv;
