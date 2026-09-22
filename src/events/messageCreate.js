import {
    Events
} from "discord.js";

import config from "../config.js";

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        // Ignore bots
        if (message.author.bot) return;

        const prefix = config.bot.prefix;

        // Ignore messages that don't start with ~
        if (!message.content.startsWith(prefix)) {
            return;
        }

        const args = message.content
            .slice(prefix.length)
            .trim()
            .split(/\s+/);

        const commandName =
            args.shift()?.toLowerCase();

        if (!commandName) return;

        /*
         * Find the command using the same
         * command collection as slash commands.
         */
        const command =
            client.commands.get(commandName);

        if (!command) {
            return;
        }

        /*
         * Prefix commands use Discord's normal
         * permission checks from the command.
         *
         * We also check whether the command has
         * a required default permission.
         */
        if (
            command.data?.default_member_permissions
        ) {
            const required =
                BigInt(
                    command.data
                        .default_member_permissions
                );

            if (
                (message.member.permissions.bitfield &
                    required) !== required
            ) {
                return message.reply(
                    "❌ You don't have permission to use that command."
                );
            }
        }

        /*
         * Prefix commands need their own execution
         * context because they aren't interactions.
         */
        try {
            await command.execute({
                message,
                client,
                args,
                user: message.author,
                member: message.member,
                guild: message.guild,
                channel: message.channel,

                reply: async (content) => {
                    return message.reply(content);
                }
            });
        } catch (error) {
            console.error(
                `Prefix command error (${commandName}):`,
                error
            );

            await message.reply(
                "❌ An error occurred while executing that command."
            ).catch(() => {});
        }
    }
};