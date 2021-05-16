import { Bitfield } from './Bitfield';

export const GatewayIntentsValues = {
  GUILDS: 0,
  GUILD_MEMBERS: 1,
  GUILD_BANS: 2,
  GUILD_EMOJI: 3,
  GUILD_INTEGRATIONS: 4,
  GUILD_WEBHOOKS: 5,
  GUILD_INVITES: 6,
  GUILD_VOICE_STATES: 7,
  GUILD_PRESENCES: 8,
  GUILD_MESSAGES: 9,
  GUILD_MESSAGE_REACTIONS: 10,
  GUILD_MESSAGE_TYPING: 11,
  DIRECT_MESSAGES: 12,
  DIRECT_MESSAGE_REACTIONS: 13,
  DIRECT_MESSAGE_TYPING: 14,
};

export class GatewayIntentsBitfield extends Bitfield<typeof GatewayIntentsValues> {
  constructor(bits?: (keyof typeof GatewayIntentsValues | number)[]) {
    super(GatewayIntentsValues, bits);
  }
}
