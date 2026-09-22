import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set channel slowmode.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        )
        .addIntegerOption(option =>
            option
                .setName("seconds")
                .setDescription("Slowmode seconds.")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
        ),

    async execute(interaction) {
        const seconds =
            interaction.options.getInteger("seconds");

        await interaction.channel.setRateLimitPerUser(
            seconds
        );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Slowmode Updated",
                    seconds === 0
                        ? "Slowmode has been disabled."
                        : `Slowmode is now **${seconds} seconds**.`
                )
            ]
        });
    }
};