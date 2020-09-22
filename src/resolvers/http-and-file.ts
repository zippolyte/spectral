import { createResolveHttp } from '@stoplight/json-ref-readers';
import { Resolver } from '@stoplight/json-ref-resolver';
import { DEFAULT_REQUEST_OPTIONS } from '../request';
import { Agent } from 'http';
import { readFile } from 'fs';
import * as URI from 'urijs';

export interface IHttpAndFileResolverOptions {
  agent?: Agent;
}

export const httpAndFileResolver = createHttpAndFileResolver();

// resolves files, http and https $refs, and internal $refs
export function createHttpAndFileResolver(opts?: IHttpAndFileResolverOptions): Resolver {
  const resolveHttp = createResolveHttp({ ...DEFAULT_REQUEST_OPTIONS, ...opts });

  const patchedResolved = (ref: URI): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const path = ref.valueOf();
      readFile(path, 'utf8', (err, data) => {
        if (err !== null) {
          reject(err);
        }
        resolve(data);
      });
    });
  };

  return new Resolver({
    resolvers: {
      https: { resolve: resolveHttp },
      http: { resolve: resolveHttp },
      file: { resolve: patchedResolved },
    },
  });
}
