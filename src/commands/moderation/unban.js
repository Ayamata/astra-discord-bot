import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed,
    errorEmbed
} from "../../utils/embeds.js";

import {
    logAction
} from "../../utils/logger.js";

import {
    EmbedBuilder
} from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        )
        .addStringOption(option =>
            option
                .setName("user")
                .setDescription(
                    "The user's ID to unban."
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "Reason for the unban."
                )
                .setRequired(false)
        ),

    // =========================
    // SLASH COMMAND
    // =========================

    async execute(interaction) {
        const userId =
            interaction.options.getString("user");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

        // Make sure it looks like a Discord snowflake
        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Invalid User ID",
                        "Please provide a valid Discord user ID."
                    )
                ],
                ephemeral: true
            });
        }

        try {
            const ban =
                await interaction.guild.bans.fetch(
                    userId
                );

            if (!ban) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "Not Banned",
                            "That user is not banned from this server."
                        )
                    ],
                    ephemeral: true
                });
            }

            await interaction.guild.members.unban(
                userId,
                reason
            );

            await logAction(
                interaction.guild,
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("Member Unbanned")
                    .addFields(
                        {
                            name: "User",
                            value:
                                `${ban.user.tag} (${ban.user.id})`
                        },
                        {
                            name: "Moderator",
                            value:
                                `${interaction.user.tag}`
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
                        "Member Unbanned",
                        `**${ban.user.tag}** has been unbanned.\n\n` +
                        `**Reason:** ${reason}`
                    )
                ]
            });

        } catch (error) {
            console.error(
                "Unban error:",
                error
            );

            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Unban Failed",
                        "I couldn't unban that user. Make sure the user ID is correct and I have the required permissions."
                    )
                ],
                ephemeral: true
            });
        }
    },

    // =========================
    // PREFIX COMMAND
    // ~unban USER_ID [reason]
    // =========================

    async prefixExecute({
        message,
        args
    }) {
        const userId = args.shift();

        if (!userId) {
            return message.reply(
                "❌ Usage: `~unban <user ID> [reason]`"
            );
        }

        if (!/^\d{17,20}$/.test(userId)) {
            return message.reply(
                "❌ Please provide a valid Discord user ID."
            );
        }

        const reason =
            args.join(" ") ||
            "No reason provided.";

        try {
            const ban =
                await message.guild.bans.fetch(
                    userId
                );

            if (!ban) {
                return message.reply(
                    "❌ That user is not banned from this server."
                );
            }

            await message.guild.members.unban(
                userId,
                reason
            );

            await logAction(
                message.guild,
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("Member Unbanned")
                    .addFields(
                        {
                            name: "User",
                            value:
                                `${ban.user.tag} (${ban.user.id})`
                        },
                        {
                            name: "Moderator",
                            value:
                                `${message.author.tag}`
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
                    .setTimestamp()
            );

            return message.reply({
                embeds: [
                    successEmbed(
                        "Member Unbanned",
                        `**${ban.user.tag}** has been unbanned.\n\n` +
                        `**Reason:** ${reason}`
                    )
                ]
            });

        } catch (error) {
            console.error(
                "Prefix unban error:",
                error
            );

            return message.reply(
                "❌ I couldn't unban that user. Check the ID and make sure I have permission to ban members."
            );
        }
    }
};