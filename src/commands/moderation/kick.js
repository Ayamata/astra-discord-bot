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

export default {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to kick.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
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
                        "Cannot Kick",
                        "That user is not in this server."
                    )
                ],
                ephemeral: true
            });
        }

        if (
            !canModerate(interaction, member) ||
            !botCanModerate(interaction, member)
        ) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Cannot Kick",
                        "The target's role is too high."
                    )
                ],
                ephemeral: true
            });
        }

        await sendModerationDM(
            member,
            "Kick",
            reason
        );

        await member.kick(reason);

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Member Kicked",
                    `**${user.tag}** was kicked.\n\n**Reason:** ${reason}`
                )
            ]
        });
    }
};