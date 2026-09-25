import {
    Events,
    EmbedBuilder
} from "discord.js";

import config from "../config.js";

export default {
    name: Events.GuildMemberAdd,

    async execute(member) {
        if (!config.welcome?.enabled) return;

        const template =
            config.welcome.message;

        if (!template) return;

        const description = template
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
                member.guild.memberCount.toString()
            );

        const embed = new EmbedBuilder()
            .setColor(
                config.welcome.color ?? 0x2EAE74
            )
            .setDescription(description)
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 256
                })
            )
            .setTimestamp();

        if (config.welcome.title) {
            embed.setTitle(
                config.welcome.title
            );
        }

        if (config.welcome.footer) {
            embed.setFooter({
                text: config.welcome.footer
            });
        }

        try {
            await member.send({
                embeds: [embed]
            });

            console.log(
                `[WELCOME] Sent welcome DM to ${member.user.tag} in ${member.guild.name}`
            );
        } catch (error) {
            console.error(
                `[WELCOME] Could not DM ${member.user.tag}:`,
                error.message
            );
        }
    }
};