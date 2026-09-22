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
        ),

    async execute(interaction) {
        if (!config.applications.enabled) {
            return interaction.reply({
                content:
                    "❌ The application system is currently disabled.",
                ephemeral: true
            });
        }

        await interaction.channel.send(
            createApplicationPanel()
        );

        return interaction.reply({
            content:
                "✅ Staff application panel sent.",
            ephemeral: true
        });
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