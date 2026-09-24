import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import config from "../../config.js";

import {
    createApplicationPanel
} from "../../utils/applications.js";

export default {
    data: new SlashCommandBuilder()
        .setName(
            config.applications.command
        )
        .setDescription(
            "Send the staff application panel."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addStringOption(value =>
            value
                .setName("application")
                .setDescription("If the Application String matches an existing one it will send it in that channel.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const value = 
            interaction.options.getString("application")
        if (!config.applications.enabled) {
            return interaction.reply({
                content:
                    "❌ The application system is currently disabled.",
                ephemeral: true
            });
        }

        if (value == "staff") {
            await interaction.channel.send(
                createApplicationPanel(value)
            );

            return interaction.reply({
                content:
                "✅ Staff application panel sent.",
                ephemeral: true
            });
        } else if (value == "test") {
            await interaction.channel.send(
                createApplicationPanel(value)
            );

            return interaction.reply({
                content:
                "✅ Test application panel sent.",
                ephemeral: true
            });
        }
    },

    async prefixExecute({
        message
    }) {
        if (!config.applications.enabled) {
            return message.reply(
                "❌ The application system is currently disabled."
            );
        }

        await message.channel.send(
            createApplicationEmbed()
        );

        return message.reply({
            content:
                "✅ Staff application panel sent."
        });
    }
};