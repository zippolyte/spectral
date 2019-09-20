import * as express from 'express';
import * as morgan from 'morgan';
import { CommandModule, showHelp } from 'yargs';

import { ILintConfig } from '../../types/config';
import { initialize } from '../services/server';

const toArray = (args: unknown) => (Array.isArray(args) ? args : [args]);

const serveCommand: CommandModule = {
  describe: 'start a HTTP server',
  command: 'serve',
  builder: yargs =>
    yargs
      .fail(() => {
        showHelp();
      })
      .options({
        port: {
          alias: 'p',
          description: 'port to listen on',
          type: 'number',
          default: 4040,
        },
        ruleset: {
          alias: 'r',
          description: 'path/URL to a ruleset file',
          type: 'string',
          coerce: toArray,
        },
        'skip-rule': {
          alias: 's',
          description: 'ignore certain rules if they are causing trouble',
          type: 'string',
          coerce: toArray,
        },
        quiet: {
          alias: 'q',
          description: 'no logging - output only',
          type: 'boolean',
        },
        logFormat: {
          alias: 'l',
          description: 'HTTP log format (combined, common, dev, short, or tiny)',
          type: 'string',
          default: 'combined',
        },
      }),

  handler: args => {
    const { ruleset, ...config } = (args as unknown) as ILintConfig;
    return initialize({ ...config }, ruleset).then(spectral => {
      const app = express();
      app.use((req: express.Request, res: express.Response, next: () => void) => {
        res.setHeader('Server', `Spectral`);
        res.removeHeader('X-Powered-By');
        next();
      });
      app.use(express.json());

      if (!args.quiet) {
        app.use(morgan((args.logFormat as string) || 'combined'));
      }

      app.post('/lint', async (req: express.Request, res: express.Response) => {
        res.send(await spectral.run(req.body));
      });

      app.listen(args.port, () => {
        console.log(`Spectral HTTP server running on port: ${args.port}`);
      });
    });
  },
};

export default serveCommand;
