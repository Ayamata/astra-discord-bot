import {
    Events,
    EmbedBuilder
} from "discord.js";

import config from "../config.js";

console.log(
    "[WELCOME] welcomeMessage.js loaded"
);

export default {
    name: Events.GuildMemberAdd,

    async execute(member) {
        console.log(
            `[WELCOME] GuildMemberAdd fired for ${member.user.tag}`
        );

        console.log(
            `[WELCOME] Enabled:`,
            config.welcome?.enabled
        );

        if (!config.welcome?.enabled) {
            console.log(
                "[WELCOME] Welcome system is disabled."
            );
            return;
        }

        const template =
            config.welcome.message;

        if (!template) {
            console.log(
                "[WELCOME] No welcome message configured."
            );
            return;
        }

        const replacePlaceholders = text =>
            text
                .replaceAll(
                    "{user}",
                    `<@${member.id}>`
                )
                .replaceAll(
                    "{username}",
                    member.user.username
                )
                .replaceAll(
                    "{server}",
                    member.guild.name
                )
                .replaceAll(
                    "{memberCount}",
                    String(member.guild.memberCount)
                );

        const embed = new EmbedBuilder()
            .setColor(
                config.welcome.color ?? 0x2EAE74
            )
            .setDescription(
                replacePlaceholders(template)
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 256
                })
            )
            .setTimestamp();

        if (config.welcome.title) {
            embed.setTitle(
                replacePlaceholders(
                    config.welcome.title
                )
            );
        }

        if (config.welcome.footer) {
            embed.setFooter({
                text: replacePlaceholders(
                    config.welcome.footer
                )
            });
        }

        try {
            await member.send({
                embeds: [embed]
            });

            console.log(
                `[WELCOME] Sent welcome DM to ${member.user.tag}`
            );
        } catch (error) {
            console.error(
                `[WELCOME] Failed to DM ${member.user.tag}:`,
                error
            );
        }
    }
};