import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    canModerate,
    botCanModerate
} from "../../utils/permissions.js";

import {
    sendModerationDM
} from "../../utils/moderation.js";

import {
    successEmbed,
    errorEmbed
} from "../../utils/embeds.js";

import {
    EmbedBuilder
} from "discord.js";

import {
    logAction
} from "../../utils/logger.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User to ban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the ban.")
                .setRequired(false)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

        const member =
            await interaction.guild.members
                .fetch(user.id)
                .catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Cannot Ban",
                        "That user is not currently in this server."
                    )
                ],
                ephemeral: true
            });
        }

        if (!canModerate(interaction, member)) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Cannot Ban",
                        "You cannot moderate this member."
                    )
                ],
                ephemeral: true
            });
        }

        if (!botCanModerate(interaction, member)) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Cannot Ban",
                        "My highest role must be above the target's highest role."
                    )
                ],
                ephemeral: true
            });
        }

        await sendModerationDM(
            member,
            "Ban",
            reason
        );

        await member.ban({
            reason
        });

        await logAction(
            interaction.guild,
            new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("Member Banned")
                .addFields(
                    {
                        name: "User",
                        value: `${user.tag} (${user.id})`
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user.tag}`
                    },
                    {
                        name: "Reason",
                        value: reason
                    }
                )
                .setTimestamp()
        );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Member Banned",
                    `**${user.tag}** has been banned.\n\n**Reason:** ${reason}`
                )
            ]
        });
    }
};