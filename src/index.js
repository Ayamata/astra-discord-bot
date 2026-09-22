import "dotenv/config";

import {
    Client,
    Collection,
    GatewayIntentBits,
    Partials
} from "discord.js";

import {
    loadCommands
} from "./handlers/commandHandler.js";

import {
    loadEvents
} from "./handlers/eventHandler.js";

const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,

            GatewayIntentBits.DirectMessages,

            GatewayIntentBits.MessageContent
        ],

        partials: [
            Partials.Channel,

            Partials.Message,
            Partials.User
        ]
    });

client.commands =
    new Collection();

await loadCommands(client);

await loadEvents(client);

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "Unhandled promise rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "Uncaught exception:",
            error
        );
    }
);

client.login(
    process.env.DISCORD_TOKEN
);