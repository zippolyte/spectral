import { isAbsolute, join } from '@stoplight/path';
import { Optional } from '@stoplight/types';

export const getResolver = (resolver: Optional<string>) => {
  if (resolver) {
    try {
      return require(isAbsolute(resolver) ? resolver : join(process.cwd(), resolver));
    } catch ({ message }) {
      throw new Error(formatMessage(message) ?? message);
    }
  }

  return {} as any;
};

function formatMessage(message: string): Optional<string> {
  return message.split(/\r?\n/)?.[0]?.replace(/\\/g, '/');
}
