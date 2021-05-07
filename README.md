# Skycord
A low-level Discord API wrapper written in TypeScript.

## Installation
To install the library, all you need to do is run the corresponding command.
- For npm: `npm install --save skycord`
- For yarn: `yarn add skycord`

## Examples

### Example Ping-pong Bot (TypeScript)
Note: This example is using TypeScript, so the [discord-api-types](https://github.com/discordjs/discord-api-types) package is used as typings for the events. If you want to run this example without modifications, you need to install the `discord-api-types` package.
```ts
import { Client } from 'skycord';
import { GatewayMessageCreateDispatchData } from 'discord-api-types';

const client = new Client();

// Initialize the rest and gateway with the bot token
// This should be done before anything else, otherwise rest and gateway will be undefined.
client.setup('your bot token here');

// On message received
client.gateway.on('MESSAGE_CREATE', async (messageCreate: GatewayMessageCreateDispatchData) => {
  // If the message is "!ping"
  if (messageCreate.content === '!ping') {
    // Send a message containing "Pong!"
    await client.rest.request(`/channels/${messageCreate.channel_id}/messages`, {
      method: 'post',
      data: {
        content: 'Pong!',
      },
    });
  }
});

// Connect to the gateway
client.gateway.connect();
```
