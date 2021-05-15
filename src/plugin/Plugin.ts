import type { ClientType } from '../client/Client';

export abstract class Plugin<O = unknown> {
  public readonly name: string;

  public readonly client: ClientType;

  public readonly pluginOptions: O;

  protected constructor(name: string, client: ClientType, pluginOptions: O) {
    this.name = name;
    this.client = client;
    this.pluginOptions = pluginOptions;
  }

  public abstract initialize(): Promise<void>;
}
