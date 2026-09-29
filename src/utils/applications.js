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
    createSubmission,
    deleteSubmission,
    getApplication,
    getSubmission,
    getSubmissionByMessage,
    setSubmissionMessage,
    updateSubmissionStatus
} from "./database.js";

const APPLICATION_START_ID =
    "application_start";

const APPLICATION_ACCEPT_ID =
    "application_accept";

const APPLICATION_DENY_ID =
    "application_deny";

const APPLICATION_INTERVIEW_ID =
    "application_interview";

const APPLICATION_COMMAND_CONFIRM_ID =
    "application_command_confirm";

const APPLICATION_COMMAND_CANCEL_ID =
    "application_command_cancel";

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

const pendingCommandReviews =
    new Map();

let pendingCommandReviewId = 0;

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
     * Reserve the application number
     */

    const number =
        createSubmission(
            guild.id,
            application.name,
            user.id
        );

    /*
     * Build the answer embeds
     */

    const embeds = [];

    let currentEmbed =
        createSubmissionEmbed(
            user,
            application,
            true,
            number
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

            const sent =
                await channel.send({
                content: isFirst
                    ? `📋 **New ${application.display_name} Application #${number}**\nApplicant: ${user}`
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

            if (isLast) {
                setSubmissionMessage(
                    number,
                    channel.id,
                    sent.id
                );
            }
        }

        console.log(
            `[APPLICATION] Successfully submitted ${application.name} application from ${user.tag}.`
        );

    } catch (error) {
        console.error(
            "[APPLICATION] Failed to send application:",
            error
        );

        deleteSubmission(number);

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
    isFirstEmbed = false,
    number = null
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
                `New ${application.display_name} Application #${number}`
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
        APPLICATION_INTERVIEW_ID,
        APPLICATION_COMMAND_CONFIRM_ID,
        APPLICATION_COMMAND_CANCEL_ID
    ].some(id =>
        interaction.customId.startsWith(
            `${id}:`
        )
    );
}

/*
 * ============================================================
 * REVIEW PERMISSIONS
 * ============================================================
 */

/*
 * Members with the reviewer role (if configured) or
 * the Manage Server permission can review.
 */
export function canReviewApplications(member) {
    const reviewerRoleId =
        config.applications.reviewerRoleId;

    return Boolean(
        (
            reviewerRoleId &&
            member?.roles.cache.has(reviewerRoleId)
        ) ||
        canManageApplications(member)
    );
}

/*
 * ============================================================
 * REVIEW DECISIONS
 * ============================================================
 */

const DECISIONS = {
    accept: {
        status: "accepted",
        label: "Accepted",
        color: () => config.embeds.successColor
    },

    deny: {
        status: "denied",
        label: "Denied",
        color: () => config.embeds.errorColor
    },

    interview: {
        status: "interview",
        label: "Interview Requested",
        color: () => config.applications.panelColor
    }
};

const FINAL_STATUSES = [
    "accepted",
    "denied"
];

/*
 * Applies a decision: DMs the applicant, updates the
 * application message and saves the new status.
 *
 * Used by both the review buttons and the
 * >approve / >deny commands.
 */
async function reviewSubmission({
    decision,
    guild,
    reviewer,
    applicant,
    label,
    submission,
    message,
    reason = null
}) {
    let roleAdded = false;

    if (decision === "accept") {
        roleAdded =
            await sendAccepted(
                guild,
                applicant,
                label,
                reason
            );
    } else if (decision === "deny") {
        await sendDenied(
            applicant,
            label,
            reason
        );
    } else {
        await sendInterview(
            applicant,
            label
        );
    }

    if (message) {
        await markApplicationReviewed(
            message,
            DECISIONS[decision].label,
            reviewer,
            DECISIONS[decision].color(),
            reason
        );
    }

    if (submission) {
        updateSubmissionStatus(
            submission.id,
            DECISIONS[decision].status,
            reviewer.id
        );
    }

    console.log(
        `[APPLICATION] ${reviewer.tag} marked ${label} application` +
        `${submission ? ` #${submission.id}` : ""} from ${applicant.tag} as ${DECISIONS[decision].label}.`
    );

    return { roleAdded };
}

/*
 * The application may have been removed since it
 * was submitted, so fall back to the stored name.
 */
function applicationLabel(guildId, name) {
    return (
        getApplication(guildId, name)?.display_name ??
        name ??
        "Staff"
    );
}

function alreadyReviewedMessage(submission) {
    return (
        `Application **#${submission.id}** was already ` +
        `**${submission.status}** by <@${submission.reviewer_id}>.`
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

    if (
        action === APPLICATION_COMMAND_CONFIRM_ID ||
        action === APPLICATION_COMMAND_CANCEL_ID
    ) {
        await handleCommandReviewConfirmation(
            interaction,
            action,
            parts[0]
        );

        return;
    }

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

    const decision = {
        [APPLICATION_ACCEPT_ID]: "accept",
        [APPLICATION_DENY_ID]: "deny",
        [APPLICATION_INTERVIEW_ID]: "interview"
    }[action];

    if (!decision) {
        return;
    }

    if (!canReviewApplications(interaction.member)) {
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

    /*
     * Applications submitted before numbering
     * was added have no stored submission.
     */

    const submission =
        getSubmissionByMessage(
            interaction.message.id
        );

    if (
        submission &&
        FINAL_STATUSES.includes(submission.status)
    ) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    "Already Reviewed",
                    alreadyReviewedMessage(submission)
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

    await reviewSubmission({
        decision,
        guild: interaction.guild,
        reviewer: interaction.user,
        applicant,
        label: applicationLabel(
            interaction.guildId,
            name
        ),
        submission,
        message: interaction.message
    });

    const description =
        decision === "interview"
            ? [
                `${applicant.tag} has been notified that the staff team would like an interview.`,
                ...(submission
                    ? [
                        "",
                        `After the interview, use \`>approve ${submission.id}\` or \`>deny ${submission.id}\`.`
                    ]
                    : [])
            ].join("\n")
            : `${applicant.tag}'s application has been ${DECISIONS[decision].status}.`;

    await interaction.reply({
        embeds: [
            successEmbed(
                `Application ${DECISIONS[decision].label}`,
                description
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * REVIEW COMMANDS (>approve / >deny)
 * ============================================================
 */

export async function handleReviewCommand({
    message,
    args,
    prefix,
    commandName,
    decision
}) {
    if (!message.guild) {
        return;
    }

    if (!canReviewApplications(message.member)) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Permission Denied",
                    "You don't have permission to review applications."
                )
            ]
        });
    }

    const number =
        Number(
            args[0]?.replace(/^#/, "")
        );

    if (
        !Number.isInteger(number) ||
        number < 1
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Missing Arguments",
                    [
                        `\`${prefix}${commandName} <application number> [reason]\``,
                        "",
                        "The number is shown on the application, e.g. **Staff Application #12**."
                    ].join("\n")
                )
            ]
        });
    }

    const submission =
        getSubmission(number);

    if (
        !submission ||
        submission.guild_id !== message.guild.id
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Application Not Found",
                    `There is no application **#${number}**.`
                )
            ]
        });
    }

    if (FINAL_STATUSES.includes(submission.status)) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Already Reviewed",
                    alreadyReviewedMessage(submission)
                )
            ]
        });
    }

    const applicant =
        await message.client.users
            .fetch(submission.user_id)
            .catch(() => null);

    if (!applicant) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "User Not Found",
                    "I couldn't find the applicant."
                )
            ]
        });
    }

    /*
     * The application message may have been deleted.
     * The decision still goes through without it.
     */

    let applicationMessage = null;

    if (
        submission.channel_id &&
        submission.message_id
    ) {
        const channel =
            await message.guild.channels
                .fetch(submission.channel_id)
                .catch(() => null);

        applicationMessage =
            await channel?.messages
                .fetch(submission.message_id)
                .catch(() => null) ??
            null;
    }

    const reason =
        args.slice(1).join(" ").slice(0, 500) ||
        null;

    const label =
        applicationLabel(
            message.guild.id,
            submission.application_name
        );

    if (decision === "accept") {
        for (const [key, pending] of pendingCommandReviews) {
            if (pending.expiresAt <= Date.now()) {
                pendingCommandReviews.delete(key);
            }
        }

        const confirmationId =
            (++pendingCommandReviewId).toString(36);

        pendingCommandReviews.set(
            confirmationId,
            {
                guildId: message.guild.id,
                reviewerId: message.author.id,
                submissionId: submission.id,
                reason,
                label,
                expiresAt: Date.now() + 15 * 60 * 1000,
                consumed: false
            }
        );

        return message.reply({
            content: [
                `Confirm approval for application **#${number}**?`,
                `${applicant}'s **${label}** application will be marked accepted and the applicant will be notified.`,
                ...(reason ? [`**Reason:** ${reason}`] : [])
            ].join("\n"),
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `${APPLICATION_COMMAND_CONFIRM_ID}:${confirmationId}`
                        )
                        .setLabel("Confirm")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(
                            `${APPLICATION_COMMAND_CANCEL_ID}:${confirmationId}`
                        )
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    const { roleAdded } =
        await reviewSubmission({
            decision,
            guild: message.guild,
            reviewer: message.author,
            applicant,
            label,
            submission,
            message: applicationMessage,
            reason
        });

    return message.reply({
        embeds: [
            successEmbed(
                `Application #${number} ${DECISIONS[decision].label}`,
                [
                    `${applicant}'s **${label}** application has been ${DECISIONS[decision].status}.`,
                    ...(reason ? [`**Reason:** ${reason}`] : []),
                    ...(roleAdded ? ["The staff role was given."] : []),
                    applicationMessage
                        ? `[Jump to application](${applicationMessage.url})`
                        : "⚠️ I couldn't find the original application message to update."
                ].join("\n")
            )
        ]
    });
}

async function handleCommandReviewConfirmation(
    interaction,
    action,
    confirmationId
) {
    const pending =
        pendingCommandReviews.get(confirmationId);

    if (
        !pending ||
        pending.expiresAt <= Date.now() ||
        pending.guildId !== interaction.guildId
    ) {
        pendingCommandReviews.delete(confirmationId);
        await interaction.reply({
            content: "This approval confirmation has expired.",
            ephemeral: true
        });
        return;
    }

    if (pending.reviewerId !== interaction.user.id) {
        await interaction.reply({
            content: "Only the reviewer who started this approval can confirm or cancel it.",
            ephemeral: true
        });
        return;
    }

    if (action === APPLICATION_COMMAND_CANCEL_ID) {
        pendingCommandReviews.delete(confirmationId);
        await interaction.update({
            content: "Approval cancelled.",
            components: []
        });
        return;
    }

    if (!canReviewApplications(interaction.member)) {
        pendingCommandReviews.delete(confirmationId);
        await interaction.update({
            content: "Your application review permission is no longer available. Approval was not performed.",
            components: []
        });
        return;
    }

    if (pending.consumed) {
        await interaction.reply({
            content: "This approval is already being processed.",
            ephemeral: true
        });
        return;
    }

    pending.consumed = true;
    await interaction.deferUpdate();

    try {
        const submission =
            getSubmission(pending.submissionId);

        if (
            !submission ||
            submission.guild_id !== interaction.guildId
        ) {
            await interaction.editReply({
                content: "This application could not be found. Approval was not performed.",
                components: []
            });
            return;
        }

        if (FINAL_STATUSES.includes(submission.status)) {
            await interaction.editReply({
                content: alreadyReviewedMessage(submission),
                components: []
            });
            return;
        }

        const applicant =
            await interaction.client.users
                .fetch(submission.user_id)
                .catch(() => null);

        if (!applicant) {
            await interaction.editReply({
                content: "I couldn't find the applicant. Approval was not performed.",
                components: []
            });
            return;
        }

        let applicationMessage = null;

        if (submission.channel_id && submission.message_id) {
            const channel =
                await interaction.guild.channels
                    .fetch(submission.channel_id)
                    .catch(() => null);

            applicationMessage =
                await channel?.messages
                    .fetch(submission.message_id)
                    .catch(() => null) ??
                null;
        }

        const { roleAdded } =
            await reviewSubmission({
                decision: "accept",
                guild: interaction.guild,
                reviewer: interaction.user,
                applicant,
                label: pending.label,
                submission,
                message: applicationMessage,
                reason: pending.reason
            });

        await interaction.editReply({
            embeds: [
                successEmbed(
                    `Application #${submission.id} Accepted`,
                    [
                        `${applicant}'s **${pending.label}** application has been accepted.`,
                        ...(pending.reason ? [`**Reason:** ${pending.reason}`] : []),
                        ...(roleAdded ? ["The staff role was given."] : []),
                        applicationMessage
                            ? `[Jump to application](${applicationMessage.url})`
                            : "⚠️ I couldn't find the original application message to update."
                    ].join("\n")
                )
            ],
            content: null,
            components: []
        });
    } finally {
        pendingCommandReviews.delete(confirmationId);
    }
}

/*
 * ============================================================
 * ACCEPT
 * ============================================================
 */

/*
 * Returns whether the staff role was added.
 */
async function sendAccepted(
    guild,
    applicant,
    label,
    reason
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
            await guild
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
                        ...(reason ? ["", `**Note:** ${reason}`] : []),
                        "",
                        roleAdded
                            ? "You have also been given the staff role."
                            : "A member of the staff team will provide your next steps."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    return roleAdded;
}

/*
 * ============================================================
 * DENY
 * ============================================================
 */

async function sendDenied(
    applicant,
    label,
    reason
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
                        ...(reason ? ["", `**Reason:** ${reason}`] : []),
                        "",
                        "You may apply again in the future."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});
}

/*
 * ============================================================
 * INTERVIEW
 * ============================================================
 */

async function sendInterview(
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
}

/*
 * ============================================================
 * MARK APPLICATION AS REVIEWED
 * ============================================================
 */

async function markApplicationReviewed(
    message,
    decision,
    reviewer,
    color,
    reason = null
) {
    const embeds =
        message.embeds.map(
            embed => EmbedBuilder.from(embed)
        );

    for (const embed of embeds) {
        embed.setColor(color);
    }

    const lastEmbed =
        embeds[embeds.length - 1];

    /*
     * After an interview a second status field is
     * added, so the embed shows the full history.
     */

    if (
        lastEmbed &&
        (lastEmbed.data.fields?.length ?? 0) < 25
    ) {
        lastEmbed
            .addFields({
                name: "Application Status",

                value:
                    `**${decision}**\n` +
                    `Reviewed by ${reviewer}` +
                    (reason ? `\n**Reason:** ${reason}` : ""),

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
    }).catch(error => {
        console.error(
            "[APPLICATION] Failed to update application message:",
            error
        );
    });
}
