import fs from "node:fs";
import path from "node:path";
import {
    fileURLToPath,
    pathToFileURL
} from "node:url";

import {
    Collection,
    Routes
} from "discord.js";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const commandsPath =
    path.join(
        __dirname,
        "../commands"
    );

/*
 * Loads every command file into client.commands.
 *
 * reload: true re-imports each command file from disk
 * (bypassing Node's module cache) so edited commands
 * take effect without restarting the bot.
 *
 * Returns the number of files that failed to load.
 */
export async function loadCommands(
    client,
    { reload = false } = {}
) {
    const commands =
        new Collection();

    const version =
        Date.now();

    let failed = 0;

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

            try {
                const url =
                    pathToFileURL(fullPath).href +
                    (reload ? `?v=${version}` : "");

                const commandModule =
                    await import(url);

                const command =
                    commandModule.default;

                if (!command) {
                    console.warn(
                        `[COMMANDS] No default export: ${entry.name}`
                    );
                    continue;
                }

                /*
                 * Get the command name.
                 *
                 * Slash commands:
                 *   data = SlashCommandBuilder
                 *
                 * Prefix-only commands:
                 *   data = { name: "clog" }
                 */
                const commandName =
                    command.data?.name;

                if (!commandName) {
                    console.warn(
                        `[COMMANDS] No command name: ${entry.name}`
                    );
                    continue;
                }

                /*
                 * Load BOTH slash and prefix commands
                 * into client.commands.
                 */
                commands.set(
                    commandName,
                    command
                );

                const types = [];

                if (
                    typeof command.prefixExecute ===
                    "function"
                ) {
                    types.push("PREFIX");
                }

                if (
                    typeof command.execute ===
                    "function"
                ) {
                    types.push("SLASH");
                }

                console.log(
                    `[COMMANDS] Loaded ${commandName}` +
                    (
                        types.length
                            ? ` [${types.join(" + ")}]`
                            : ""
                    )
                );
            } catch (error) {
                failed++;

                console.error(
                    `[COMMANDS] Failed to load ${entry.name}:`,
                    error
                );
            }
        }
    }

    await walk(commandsPath);

    /*
     * Swap in the new set all at once so commands
     * keep working while files are being imported.
     */
    client.commands = commands;

    return failed;
}

/*
 * Registers every slash command in client.commands
 * with Discord for GUILD_ID, replacing the old set.
 *
 * Returns the number of slash commands registered.
 */
export async function registerSlashCommands(client) {
    const body =
        client.commands
            .filter(command =>
                typeof command.data?.toJSON ===
                "function"
            )
            .map(command =>
                command.data.toJSON()
            );

    await client.rest.put(
        Routes.applicationGuildCommands(
            client.application.id,
            process.env.GUILD_ID
        ),
        { body }
    );

    return body.length;
}
