import fs from "node:fs";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

export async function loadCommands(client) {
    const commandsPath =
        path.join(
            __dirname,
            "../commands"
        );

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
                const commandModule =
                    await import(
                        `file://${fullPath}`
                    );

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
                client.commands.set(
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
                console.error(
                    `[COMMANDS] Failed to load ${entry.name}:`,
                    error
                );
            }
        }
    }

    await walk(commandsPath);
}