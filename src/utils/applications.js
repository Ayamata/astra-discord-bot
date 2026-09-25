import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits
} from "discord.js";

import config from "../config.js";

import {
    errorEmbed,
    successEmbed
} from "./embeds.js";

import {
    getApplication
} from "./database.js";

const APPLICATION_START_ID =
    "application_start";

const APPLICATION_ACCEPT_ID =
    "application_accept";

const APPLICATION_DENY_ID =
    "application_deny";

const APPLICATION_INTERVIEW_ID =
    "application_interview";

const CANCEL_TEXT =
    "CANCEL";

/*
 * Application names are used inside button IDs,
 * so keep them short and simple.
 */
export const APPLICATION_NAME_PATTERN =
    /^[a-z0-9_-]{1,32}$/;

export const MAX_QUESTIONS = 25;

export const MAX_QUESTION_LENGTH = 250;

export const MAX_DESCRIPTION_LENGTH = 2000;

/*
 * Answers are grouped into embeds of this many
 * questions to keep the submission readable.
 */
const QUESTIONS_PER_EMBED = 4;

/*
 * Discord allows 6000 characters across all
 * embeds in a single message.
 */
const MESSAGE_EMBED_CHARACTER_LIMIT = 5800;

/*
 * Users currently filling out an application.
 * Prevents two applications running in the
 * same DM at once.
 */
const activeApplicants =
    new Set();

function timeoutMinutes() {
    return Math.floor(
        config.applications.questionTimeout / 60000
    );
}

/*
 * ============================================================
 * COMMAND HELPERS
 * ============================================================
 */

export function canManageApplications(member) {
    return Boolean(
        member?.permissions.has(
            PermissionFlagsBits.ManageGuild
        )
    );
}

/*
 * Returns everything after "<prefix><command>"
 * with the original spacing preserved.
 */
export function getRawArguments(message, prefix) {
    return message.content
        .slice(prefix.length)
        .trim()
        .replace(/^\S+\s*/, "");
}

/*
 * Splits arguments either by "|" or by quotes.
 *
 *   staff | Join the team | Question one? | Question two?
 *   staff "Join the team" "Question one?" "Question two?"
 *
 * Words outside quotes become their own argument.
 * Smart quotes (from mobile keyboards) are supported.
 */
export function parseArguments(raw) {
    if (raw.includes("|")) {
        return raw
            .split("|")
            .map(part => part.trim())
            .filter(Boolean);
    }

    const normalized =
        raw.replace(/[“”„]/g, "\"");

    const args = [];

    const pattern =
        /"([^"]*)"|(\S+)/g;

    let match;

    while ((match = pattern.exec(normalized))) {
        const value =
            (match[1] ?? match[2]).trim();

        if (value) {
            args.push(value);
        }
    }

    return args;
}

/*
 * Accepts a channel mention, ID, or name.
 */
export function resolveTextChannel(guild, input) {
    if (!input) {
        return null;
    }

    const id =
        input.replace(/^<#(\d+)>$/, "$1");

    const channel =
        guild.channels.cache.get(id) ??
        guild.channels.cache.find(
            channel =>
                channel.name.toLowerCase() ===
                input.replace(/^#/, "").toLowerCase()
        );

    if (!channel?.isTextBased()) {
        return null;
    }

    return channel;
}

/*
 * ============================================================
 * APPLICATION PANEL
 * ============================================================
 */

export function createApplicationPanel(application) {
    const embed =
        new EmbedBuilder()
            .setColor(
                config.applications.panelColor
            )
            .setTitle(
                `${application.display_name} Application`
            )
            .setDescription(
                [
                    application.description,
                    "",
                    "Click the button below to start your application.",
                    "",
                    "The application will take place through **DMs**.",
                    `You will receive **${application.questions.length}** questions, one at a time.`,
                    "",
                    `You have **${timeoutMinutes()} minutes** to answer each question.`,
                    "",
                    `Type \`${CANCEL_TEXT}\` at any time to cancel.`
                ].join("\n")
            )
            .setFooter({
                text:
                    `${application.display_name} Application System`
            })
            .setTimestamp();

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `${APPLICATION_START_ID}:${application.name}`
                    )
                    .setLabel(
                        "Start Application"
                    )
                    .setEmoji("📝")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

/*
 * ============================================================
 * START APPLICATION
 * ============================================================
 */

export async function startApplication(
    interaction,
    name
) {
    const user =
        interaction.user;

    if (!config.applications.enabled) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    "Applications Closed",
                    "The application system is currently disabled."
                )
            ],
            ephemeral: true
        });
    }

    const application =
        getApplication(
            interaction.guildId,
            name
        );

    if (!application) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    "Application Not Found",
                    "This application no longer exists."
                )
            ],
            ephemeral: true
        });
    }

    if (activeApplicants.has(user.id)) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    "Application In Progress",
                    "You already have an application in progress. Check your DMs, or type `CANCEL` there to stop it."
                )
            ],
            ephemeral: true
        });
    }

    const title =
        `${application.display_name} Application`;

    let dm;

    try {
        dm =
            await user.createDM();

        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        config.applications.panelColor
                    )
                    .setTitle(title)
                    .setDescription(
                        [
                            `Hello ${user}!`,
                            "",
                            `Welcome to the **${title}**.`,
                            "",
                            `Type \`${CANCEL_TEXT}\` at any time to cancel.`,
                            "",
                            `You have **${timeoutMinutes()} minutes** to answer each question.`
                        ].join("\n")
                    )
                    .setFooter({
                        text:
                            `${title} System`
                    })
                    .setTimestamp()
            ]
        });

    } catch (error) {
        console.error(
            "[APPLICATION] Could not open DM:",
            error
        );

        return interaction.reply({
            embeds: [
                errorEmbed(
                    "Unable to Start Application",
                    "I couldn't send you a DM. Please enable direct messages from server members and try again."
                )
            ],
            ephemeral: true
        });
    }

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Started",
                `I've sent you a DM with the **${title}**.`
            )
        ],
        ephemeral: true
    });

    activeApplicants.add(user.id);

    try {
        const answers =
            await askQuestions(
                user,
                dm,
                application
            );

        if (answers) {
            await submitApplication(
                user,
                application,
                answers,
                dm
            );
        }
    } finally {
        activeApplicants.delete(user.id);
    }
}

/*
 * Returns the answers, or null if the
 * application was cancelled or timed out.
 */
async function askQuestions(
    user,
    dm,
    application
) {
    const answers = [];

    const total =
        application.questions.length;

    for (
        let index = 0;
        index < total;
        index++
    ) {
        const question =
            application.questions[index];

        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        config.applications.panelColor
                    )
                    .setTitle(
                        `Question ${index + 1} of ${total}`
                    )
                    .setDescription(
                        [
                            question,
                            "",
                            "**Reply with one message containing your answer.**",
                            "",
                            `Type \`${CANCEL_TEXT}\` to cancel.`
                        ].join("\n")
                    )
                    .setFooter({
                        text:
                            `${index + 1}/${total} • ${application.display_name} Application`
                    })
            ]
        });

        const collected =
            await dm.awaitMessages({
                filter: message =>
                    message.author.id ===
                        user.id &&
                    !message.author.bot,

                max: 1,

                time:
                    config.applications
                        .questionTimeout,

                errors: ["time"]
            }).catch(() => null);

        /*
         * Timeout
         */

        if (!collected) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Application Cancelled",
                        "You took too long to answer the current question."
                    )
                ]
            });

            return null;
        }

        const content =
            collected.first()?.content.trim() ?? "";

        /*
         * Cancel
         */

        if (
            content.toUpperCase() ===
            CANCEL_TEXT
        ) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Application Cancelled",
                        "Your application has been cancelled."
                    )
                ]
            });

            return null;
        }

        /*
         * Empty answer (e.g. only an attachment)
         */

        if (!content) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Invalid Answer",
                        "Your answer cannot be empty."
                    )
                ]
            });

            index--;
            continue;
        }

        answers.push(content);

        if (index + 1 < total) {
            await dm.send({
                embeds: [
                    successEmbed(
                        "Answer Recorded",
                        "Your answer has been recorded. Moving to the next question..."
                    )
                ]
            });
        }
    }

    return answers;
}

/*
 * ============================================================
 * SUBMIT APPLICATION
 * ============================================================
 */

async function submitApplication(
    user,
    application,
    answers,
    dm
) {
    console.log(
        `[APPLICATION] Preparing ${application.name} submission for ${user.tag} (${user.id})`
    );

    const channel =
        await user.client.channels
            .fetch(
                config.applications.channelId
            )
            .catch(error => {
                console.error(
                    "[APPLICATION] Failed to fetch application channel:",
                    error
                );

                return null;
            });

    if (!channel) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "Your application was completed, but I couldn't find the configured application channel."
                )
            ]
        });

        return;
    }

    if (!channel.isTextBased()) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "The configured application channel cannot receive messages."
                )
            ]
        });

        return;
    }

    /*
     * Check bot permissions
     */

    const guild =
        channel.guild;

    const botMember =
        guild.members.me ??
        await guild.members
            .fetch(user.client.user.id)
            .catch(() => null);

    if (!botMember) {
        console.error(
            "[APPLICATION] Could not find bot member."
        );

        return;
    }

    const permissions =
        channel.permissionsFor(
            botMember
        );

    if (
        !permissions?.has(
            "ViewChannel"
        ) ||
        !permissions?.has(
            "SendMessages"
        ) ||
        !permissions?.has(
            "EmbedLinks"
        )
    ) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "I don't have permission to send applications to the configured channel."
                )
            ]
        });

        return;
    }

    /*
     * Build the answer embeds
     */

    const embeds = [];

    let currentEmbed =
        createSubmissionEmbed(
            user,
            application,
            true
        );

    for (
        let index = 0;
        index < answers.length;
        index++
    ) {
        if (
            index > 0 &&
            index % QUESTIONS_PER_EMBED === 0
        ) {
            embeds.push(currentEmbed);

            currentEmbed =
                createSubmissionEmbed(
                    user,
                    application,
                    false
                );
        }

        const answer =
            answers[index] ||
            "No answer provided.";

        currentEmbed.addFields({
            name:
                `Q${index + 1}: ${application.questions[index]}`
                    .slice(0, 256),

            value:
                answer.length > 1024
                    ? `${answer.slice(0, 1021)}...`
                    : answer,

            inline: false
        });
    }

    embeds.push(currentEmbed);

    /*
     * Split the embeds across messages so no
     * message goes over Discord's size limit.
     * The review buttons go on the last message.
     */

    const messages = [];

    let group = [];
    let groupLength = 0;

    for (const embed of embeds) {
        const length =
            embedLength(embed);

        if (
            group.length &&
            groupLength + length >
                MESSAGE_EMBED_CHARACTER_LIMIT
        ) {
            messages.push(group);

            group = [];
            groupLength = 0;
        }

        group.push(embed);
        groupLength += length;
    }

    messages.push(group);

    try {
        for (
            let index = 0;
            index < messages.length;
            index++
        ) {
            const isFirst = index === 0;

            const isLast =
                index === messages.length - 1;

            await channel.send({
                content: isFirst
                    ? `📋 **New ${application.display_name} Application**\nApplicant: ${user}`
                    : undefined,

                embeds: messages[index],

                components: isLast
                    ? [
                        createReviewButtons(
                            user.id,
                            application.name
                        )
                    ]
                    : []
            });
        }

        console.log(
            `[APPLICATION] Successfully submitted ${application.name} application from ${user.tag}.`
        );

    } catch (error) {
        console.error(
            "[APPLICATION] Failed to send application:",
            error
        );

        await dm.send({
            embeds: [
                errorEmbed(
                    "Submission Failed",
                    "Your application was completed, but I couldn't send it to the staff team."
                )
            ]
        });

        return;
    }

    /*
     * Tell applicant
     */

    await dm.send({
        embeds: [
            successEmbed(
                "Application Submitted",
                [
                    `Thank you for submitting the **${application.display_name} Application**!`,
                    "",
                    "Your application has been submitted successfully.",
                    "",
                    "The staff team will review your application."
                ].join("\n")
            )
        ]
    });
}

function embedLength(embed) {
    const data =
        embed.data;

    return (
        (data.title?.length ?? 0) +
        (data.description?.length ?? 0) +
        (data.footer?.text.length ?? 0) +
        (data.author?.name.length ?? 0) +
        (data.fields ?? []).reduce(
            (total, field) =>
                total +
                field.name.length +
                field.value.length,
            0
        )
    );
}

/*
 * ============================================================
 * SUBMISSION EMBED
 * ============================================================
 */

function createSubmissionEmbed(
    user,
    application,
    isFirstEmbed = false
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                config.applications.applicationColor
            )
            .setFooter({
                text:
                    `User ID: ${user.id}`
            });

    // Only the first embed gets the application header.
    if (isFirstEmbed) {
        embed
            .setTitle(
                `New ${application.display_name} Application`
            )
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL({
                    size: 256
                })
            });
    }

    return embed;
}

/*
 * ============================================================
 * REVIEW BUTTONS
 * ============================================================
 */

function createReviewButtons(
    userId,
    name,
    disabled = false
) {
    const suffix =
        `${userId}:${name}`;

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    disabled
                        ? "application_reviewed_accept"
                        : `${APPLICATION_ACCEPT_ID}:${suffix}`
                )
                .setLabel("Accept")
                .setEmoji("✅")
                .setStyle(
                    ButtonStyle.Success
                )
                .setDisabled(disabled),

            new ButtonBuilder()
                .setCustomId(
                    disabled
                        ? "application_reviewed_deny"
                        : `${APPLICATION_DENY_ID}:${suffix}`
                )
                .setLabel("Deny")
                .setEmoji("❌")
                .setStyle(
                    ButtonStyle.Danger
                )
                .setDisabled(disabled),

            new ButtonBuilder()
                .setCustomId(
                    disabled
                        ? "application_reviewed_interview"
                        : `${APPLICATION_INTERVIEW_ID}:${suffix}`
                )
                .setLabel("Interview")
                .setEmoji("🎤")
                .setStyle(
                    ButtonStyle.Primary
                )
                .setDisabled(disabled)
        );
}

/*
 * ============================================================
 * APPLICATION BUTTON DETECTION
 * ============================================================
 */

export function isApplicationButton(
    interaction
) {
    if (!interaction.isButton()) {
        return false;
    }

    return [
        APPLICATION_START_ID,
        APPLICATION_ACCEPT_ID,
        APPLICATION_DENY_ID,
        APPLICATION_INTERVIEW_ID
    ].some(id =>
        interaction.customId.startsWith(
            `${id}:`
        )
    );
}

/*
 * ============================================================
 * HANDLE APPLICATION BUTTONS
 * ============================================================
 */

export async function handleApplicationButton(
    interaction
) {
    const [
        action,
        ...parts
    ] =
        interaction.customId.split(":");

    /*
     * Start button: application_start:<name>
     */

    if (
        action ===
        APPLICATION_START_ID
    ) {
        await startApplication(
            interaction,
            parts[0]
        );

        return;
    }

    /*
     * Review buttons: <action>:<userId>:<name>
     */

    const [
        userId,
        name
    ] = parts;

    /*
     * Reviewer permission
     */

    if (
        config.applications
            .reviewerRoleId &&
        !interaction.member.roles.cache.has(
            config.applications
                .reviewerRoleId
        )
    ) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    "Permission Denied",
                    "You don't have permission to review applications."
                )
            ],
            ephemeral: true
        });

        return;
    }

    const applicant =
        await interaction.client.users
            .fetch(userId)
            .catch(() => null);

    if (!applicant) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    "User Not Found",
                    "I couldn't find the applicant."
                )
            ],
            ephemeral: true
        });

        return;
    }

    /*
     * The application may have been removed
     * since this was submitted.
     */

    const label =
        getApplication(
            interaction.guildId,
            name
        )?.display_name ??
        name ??
        "Staff";

    if (
        action ===
        APPLICATION_ACCEPT_ID
    ) {
        await handleAccept(
            interaction,
            applicant,
            label
        );

        return;
    }

    if (
        action ===
        APPLICATION_DENY_ID
    ) {
        await handleDeny(
            interaction,
            applicant,
            label
        );

        return;
    }

    if (
        action ===
        APPLICATION_INTERVIEW_ID
    ) {
        await handleInterview(
            interaction,
            applicant,
            label
        );
    }
}

/*
 * ============================================================
 * ACCEPT
 * ============================================================
 */

async function handleAccept(
    interaction,
    applicant,
    label
) {
    let roleAdded = false;

    /*
     * Give staff role if configured
     */

    if (
        config.applications
            .staffRoleId
    ) {
        const member =
            await interaction.guild
                .members
                .fetch(applicant.id)
                .catch(() => null);

        if (member) {
            try {
                await member.roles.add(
                    config.applications
                        .staffRoleId,
                    `${label} application accepted`
                );

                roleAdded = true;

            } catch (error) {
                console.error(
                    "[APPLICATION] Failed to add staff role:",
                    error
                );
            }
        }
    }

    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.embeds
                        .successColor
                )
                .setTitle(
                    `${label} Application Accepted`
                )
                .setDescription(
                    [
                        `Congratulations ${applicant}!`,
                        "",
                        `Your **${label}** application has been accepted.`,
                        "",
                        roleAdded
                            ? "You have also been given the staff role."
                            : "A member of the staff team will provide your next steps."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    await markApplicationReviewed(
        interaction,
        "Accepted",
        interaction.user,
        config.embeds.successColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Accepted",
                `${applicant.tag}'s application has been accepted.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * DENY
 * ============================================================
 */

async function handleDeny(
    interaction,
    applicant,
    label
) {
    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.embeds
                        .errorColor
                )
                .setTitle(
                    `${label} Application Update`
                )
                .setDescription(
                    [
                        `Hello ${applicant},`,
                        "",
                        `Thank you for taking the time to submit a **${label}** application.`,
                        "",
                        "Unfortunately, your application was not accepted at this time.",
                        "",
                        "You may apply again in the future."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    await markApplicationReviewed(
        interaction,
        "Denied",
        interaction.user,
        config.embeds.errorColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Denied",
                `${applicant.tag}'s application has been denied.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * INTERVIEW
 * ============================================================
 */

async function handleInterview(
    interaction,
    applicant,
    label
) {
    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.applications
                        .panelColor
                )
                .setTitle(
                    `${label} Interview`
                )
                .setDescription(
                    [
                        `Hello ${applicant}!`,
                        "",
                        `The staff team has reviewed your **${label}** application and would like to speak with you in an interview.`,
                        "",
                        "A staff member will contact you with the next steps."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    await markApplicationReviewed(
        interaction,
        "Interview Requested",
        interaction.user,
        config.applications
            .panelColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Interview Requested",
                `${applicant.tag} has been notified that the staff team would like an interview.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * MARK APPLICATION AS REVIEWED
 * ============================================================
 */

async function markApplicationReviewed(
    interaction,
    decision,
    reviewer,
    color
) {
    const message =
        interaction.message;

    if (!message) {
        return;
    }

    const embeds =
        message.embeds.map(
            embed => EmbedBuilder.from(embed)
        );

    for (const embed of embeds) {
        embed.setColor(color);
    }

    const lastEmbed =
        embeds[embeds.length - 1];

    if (lastEmbed) {
        lastEmbed
            .addFields({
                name: "Application Status",

                value:
                    `**${decision}**\n` +
                    `Reviewed by ${reviewer}`,

                inline: false
            })
            .setTimestamp();
    }

    /*
     * Disable the review buttons.
     */

    await message.edit({
        embeds,
        components: [
            createReviewButtons(
                null,
                null,
                true
            )
        ]
    });
}
