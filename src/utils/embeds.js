import {
    EmbedBuilder
} from "discord.js";

import config from "../config.js";

export function successEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.embeds.successColor)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

export function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.embeds.errorColor)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

export function warningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.embeds.warningColor)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

export function infoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}