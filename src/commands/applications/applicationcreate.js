import {
    createApplication,
    getApplication
} from "../../utils/database.js";

import {
    errorEmbed,
    successEmbed
} from "../../utils/embeds.js";

import {
    APPLICATION_NAME_PATTERN,
    MAX_DESCRIPTION_LENGTH,
    MAX_QUESTIONS,
    MAX_QUESTION_LENGTH,
    canManageApplications,
    getRawArguments,
    parseArguments
} from "../../utils/applications.js";

function usage(prefix) {
    return [
        `\`${prefix}applicationcreate <name> "<description>" "<question 1>" "<question 2>" ...\``,
        "",
        "Or separate everything with `|`:",
        `\`${prefix}applicationcreate <name> | <description> | <question 1> | <question 2> ...\``,
        "",
        "**Example:**",
        `\`${prefix}applicationcreate staff "Want to join the staff team?" "What is your timezone?" "Why do you want to join?"\``
    ].join("\n");
}

function validate(
    guildId,
    name,
    description,
    questions,
    prefix
) {
    if (!APPLICATION_NAME_PATTERN.test(name)) {
        return "The name can only contain letters, numbers, `-` and `_`, and must be at most 32 characters.";
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return `The description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;
    }

    if (questions.length > MAX_QUESTIONS) {
        return `An application can have at most ${MAX_QUESTIONS} questions.`;
    }

    if (
        questions.some(
            question =>
                question.length > MAX_QUESTION_LENGTH
        )
    ) {
        return `Each question must be at most ${MAX_QUESTION_LENGTH} characters.`;
    }

    if (getApplication(guildId, name)) {
        return `An application named **${name}** already exists. Remove it first with \`${prefix}applicationremove ${name}\`.`;
    }

    return null;
}

export default {
    data: {
        name: "applicationcreate"
    },

    async prefixExecute({
        message,
        prefix
    }) {
        if (!message.guild) {
            return;
        }

        if (!canManageApplications(message.member)) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the **Manage Server** permission to create applications."
                    )
                ]
            });
        }

        const [
            displayName,
            description,
            ...questions
        ] =
            parseArguments(
                getRawArguments(message, prefix)
            );

        if (
            !displayName ||
            !description ||
            !questions.length
        ) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Missing Arguments",
                        usage(prefix)
                    )
                ]
            });
        }

        const name =
            displayName.toLowerCase();

        const problem =
            validate(
                message.guild.id,
                name,
                description,
                questions,
                prefix
            );

        if (problem) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Invalid Application",
                        problem
                    )
                ]
            });
        }

        createApplication(
            message.guild.id,
            name,
            displayName,
            description,
            questions,
            message.author.id
        );

        return message.reply({
            embeds: [
                successEmbed(
                    "Application Created",
                    [
                        `**${displayName}** was created with **${questions.length}** question(s):`,
                        "",
                        ...questions.map(
                            (question, index) =>
                                `**${index + 1}.** ${question}`
                        ),
                        "",
                        `Send it with \`${prefix}applicationsend ${name} #channel\`.`
                    ].join("\n").slice(0, 4096)
                )
            ]
        });
    }
};
