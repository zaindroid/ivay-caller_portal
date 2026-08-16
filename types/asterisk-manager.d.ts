declare module "asterisk-manager" {
  import { EventEmitter } from "events";

  class AsteriskManager extends EventEmitter {
    constructor(port: number | string, host: string, user: string, pass: string, events: boolean);
    keepConnected(): void;
    action(
      options: Record<string, string | number | boolean>,
      callback?: (err: Error | null, res?: Record<string, string>) => void
    ): void;
    connected: boolean;
  }

  export = AsteriskManager;
}
