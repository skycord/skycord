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
import { Client, LocalRestClient, RestRoutes } from 'skycord';
import { GatewayMessageCreateDispatchData } from 'discord-api-types';

const client = new Client({
  token: 'your bot token here',
});

// Initialize the rest client (must be done before the gateway client)
client.initializeNewRestClient(LocalRestClient);

// Initialize the gateway client
client.initializeNewGatewayClient();

// On message received
client.gateway.on('MESSAGE_CREATE', async (messageCreate: GatewayMessageCreateDispatchData) => {
  // If the message is "!ping"
  if (messageCreate.content === '!ping') {
    // Send a message containing "Pong!"
    await client.rest.request(RestRoutes.CHANNEL_MESSAGES(messageCreate.channel_id), {
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
