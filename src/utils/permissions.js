import {
    PermissionFlagsBits
} from "discord.js";

import config from "../config.js";

export function isModerator(interaction) {
    if (!interaction.member) return false;

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    if (
        config.moderation.moderatorRoleId &&
        interaction.member.roles.cache.has(
            config.moderation.moderatorRoleId
        )
    ) {
        return true;
    }

    return false;
}

export function canModerate(
    interaction,
    target
) {
    if (!interaction.member) return false;

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    if (!target) return false;

    return (
        interaction.member.roles.highest.position >
        target.roles.highest.position
    );
}

export function botCanModerate(
    interaction,
    target
) {
    const botMember =
        interaction.guild.members.me;

    if (!botMember || !target) {
        return false;
    }

    return (
        botMember.roles.highest.position >
        target.roles.highest.position
    );
}