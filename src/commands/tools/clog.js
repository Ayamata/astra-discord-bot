import { EmbedBuilder } from "discord.js";
import { canUseToolCommands } from "../../utils/commandPermissions.js";

export default {
    data: {
        name: "clog"
    },

    async prefixExecute({ message, args }) {
        console.log("[DEBUG] clog command reached");

        if (!canUseToolCommands(message.member)) {
            return message.reply(
                "❌ You are not authorized to use this command."
            );
        }

        if (!args.length) {
            return message.reply("Usage: `>clog <message>`");
        }

        const content = args.join(" ");

        console.log(
            `[DISCORD] ${message.author.id} (${message.author.tag}): ${content}`
        );

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00ff7f)
                    .setTitle("Console Log")
                    .setDescription(
                        "The message has been written to the console log."
                    )
            ]
        });
    }
};