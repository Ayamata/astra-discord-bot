import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
    REST,
    Routes
} from "discord.js";

import {
    fileURLToPath
} from "node:url";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const commands = [];

async function walk(directory) {
    const entries =
        fs.readdirSync(
            directory,
            { withFileTypes: true }
        );

    for (const entry of entries) {
        const fullPath =
            path.join(
                directory,
                entry.name
            );

        if (entry.isDirectory()) {
            await walk(fullPath);
            continue;
        }

        if (!entry.name.endsWith(".js")) {
            continue;
        }

        const command =
            await import(
                `file://${fullPath}`
            );

        if (
            command.default?.data &&
            typeof command.default.data.toJSON === "function"
        ) {
            commands.push(
                command.default.data.toJSON()
            );
        }
    }
}

await walk(
    path.join(
        __dirname,
        "commands"
    )
);

const rest =
    new REST({
        version: "10"
    }).setToken(
        process.env.DISCORD_TOKEN
    );

const commandNames = new Map();

for (const command of commands) {
    if (commandNames.has(command.name)) {
        console.error(
            `❌ Duplicate command detected: "${command.name}"`
        );

        console.error(
            "Remove one of the duplicate command files."
        );

        process.exit(1);
    }

    commandNames.set(
        command.name,
        command
    );
}

console.log(
    `Registering ${commands.length} commands...`
);

await rest.put(
    Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
    ),
    {
        body: commands
    }
);

console.log(
    "Commands registered successfully."
);