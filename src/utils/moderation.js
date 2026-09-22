import {
    EmbedBuilder
} from "discord.js";

import config from "../config.js";
import {
    addWarning,
    getWarnings
} from "./database.js";

export async function sendModerationDM(
    member,
    action,
    reason
) {
    if (!config.moderation.dmUsers) {
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(config.embeds.warningColor)
        .setTitle(`Moderation Action: ${action}`)
        .addFields(
            {
                name: "Server",
                value: member.guild.name
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp();

    await member.send({
        embeds: [embed]
    }).catch(() => {});
}

export async function createWarning(
    interaction,
    member,
    reason
) {
    addWarning(
        interaction.guild.id,
        member.id,
        interaction.user.id,
        reason
    );

    const warnings = getWarnings(
        interaction.guild.id,
        member.id
    );

    return warnings.length;
}