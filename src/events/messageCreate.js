import { Events } from "discord.js";
import config from "../config.js";
import { handleLauncherTicketMessage } from "../utils/tickets.js";

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (message.webhookId) {
            const handled = await handleLauncherTicketMessage(message).catch((error) => {
                console.error("[TICKETS] Launcher intake failed:", error);
                return false;
            });
            if (handled) return;
        }

        // Ignore bots
        if (message.author.bot) return;

        const prefix = config.bot.prefix;

        // Message doesn't use our prefix
        if (!message.content.startsWith(prefix)) return;

        const content = message.content
            .slice(prefix.length)
            .trim();

        if (!content) return;

        const args = content.split(/\s+/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const command = client.commands.get(commandName);

        console.log(
            `[PREFIX] ${message.author.tag} used ${prefix}${commandName}`
        );
        
        console.log(
            `[PREFIX] Found command:`,
            command ? "YES" : "NO"
        );

        if (command) {
            console.log(
                `[PREFIX] Has prefixExecute:`,
                typeof command.prefixExecute
            );
        }

        if (!command) return;
        
        // Prefix-only commands use prefixExecute()
        if (typeof command.prefixExecute !== "function") return;

        try {
            await command.prefixExecute({
                message,
                client,
                args,
                user: message.author,
                member: message.member,
                guild: message.guild,
                channel: message.channel,
                prefix,

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