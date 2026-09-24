import {
    spawn
} from "node:child_process";

import config from "../../config.js";

import {
    canUseToolCommands
} from "../../utils/commandPermissions.js";

const MAX_OUTPUT_LENGTH = 1900;

/*
 * Commands that are allowed through Discord.
 *
 * We intentionally do NOT expose arbitrary shell
 * commands.
 */
const ALLOWED_COMMANDS = {
    init: {
        args: []
    },

    status: {
        args: []
    },

    add: {
        args: ["."]
    },

    pull: {
        args: []
    },

    push: {
        args: []
    },

    fetch: {
        args: []
    },

    log: {
        args: []
    },

    branch: {
        args: []
    },

    diff: {
        args: []
    },

    remote: {
        args: []
    },

    show: {
        args: []
    },

    /*
     * commit is handled separately because
     * it accepts a commit message.
     */
    commit: {
        args: null
    }
};

export default {
    data: {
        name: "git"
    },

    async prefixExecute({
        message,
        args
    }) {
        /*
         * ==========================================
         * PERMISSION CHECK
         * ==========================================
         */

        if (
            !canUseToolCommands(
                message.author.id
            )
        ) {
            return message.reply(
                "❌ You are not authorized to use Git commands."
            );
        }

        /*
         * ==========================================
         * HELP
         * ==========================================
         */

        if (!args.length) {
            return sendHelp(message);
        }

        const command =
            args.shift().toLowerCase();

        if (
            command === "help"
        ) {
            return sendHelp(message);
        }

        /*
         * ==========================================
         * UNKNOWN COMMAND
         * ==========================================
         */

        if (
            !ALLOWED_COMMANDS[command]
        ) {
            return message.reply({
                content: [
                    `❌ Unknown Git command: \`${command}\``,
                    "",
                    "Use `>git help` to see the available commands."
                ].join("\n")
            });
        }

        /*
         * ==========================================
         * BUILD GIT ARGUMENTS
         * ==========================================
         */

        let gitArgs;

        try {
            gitArgs =
                buildGitArguments(
                    command,
                    args
                );
        } catch (error) {
            return message.reply({
                content:
                    `❌ ${error.message}`
            });
        }

        /*
         * ==========================================
         * RUN GIT
         * ==========================================
         */

        await message.channel.sendTyping();

        const result =
            await runGit(
                gitArgs
            );

        /*
         * ==========================================
         * OUTPUT
         * ==========================================
         */

        const output =
            result.output.trim();

        const status =
            result.code === 0
                ? "✅"
                : "❌";

        let response =
            `${status} \`git ${gitArgs.join(" ")}\`\n`;

        if (output) {
            response += `\`\`\`\n${truncateOutput(
                output
            )}\n\`\`\``;
        } else {
            response +=
                "```text\n(no output)\n```";
        }

        await message.reply(
            response
        );
    }
};

/*
 * ============================================================
 * HELP
 * ============================================================
 */

async function sendHelp(
    message
) {
    return message.reply({
        content: [
            "**Astra Git Commands**",
            "",
            "`>git init`",
            "`>git status`",
            "`>git add .`",
            "`>git commit \"message\"`",
            "`>git pull`",
            "`>git push`",
            "`>git fetch`",
            "`>git log`",
            "`>git branch`",
            "`>git diff`",
            "`>git remote`",
            "`>git show`",
            "",
            "Use `>git help` to display this menu."
        ].join("\n")
    });
}

/*
 * ============================================================
 * BUILD SAFE GIT ARGUMENTS
 * ============================================================
 */

function buildGitArguments(
    command,
    args
) {
    switch (command) {

        case "init":
            return [
                "init"
            ];

        case "status":
            return [
                "status"
            ];

        case "add":
            /*
             * Only allow:
             *
             * >git add .
             */
            if (
                args.length !== 1 ||
                args[0] !== "."
            ) {
                throw new Error(
                    "The only supported add command is `>git add .`."
                );
            }

            return [
                "add",
                "."
            ];

        case "pull":
            if (args.length) {
                throw new Error(
                    "Usage: `>git pull`"
                );
            }

            return [
                "pull"
            ];

        case "push":
            if (args.length) {
                throw new Error(
                    "Usage: `>git push`"
                );
            }

            return [
                "push"
            ];

        case "fetch":
            if (args.length) {
                throw new Error(
                    "Usage: `>git fetch`"
                );
            }

            return [
                "fetch"
            ];

        case "log":
            /*
             * Give Discord a useful compact log.
             */
            if (args.length) {
                throw new Error(
                    "Usage: `>git log`"
                );
            }

            return [
                "log",
                "--oneline",
                "--decorate",
                "-20"
            ];

        case "branch":
            if (args.length) {
                throw new Error(
                    "Usage: `>git branch`"
                );
            }

            return [
                "branch",
                "-a"
            ];

        case "diff":
            if (args.length) {
                throw new Error(
                    "Usage: `>git diff`"
                );
            }

            return [
                "diff"
            ];

        case "remote":
            if (args.length) {
                throw new Error(
                    "Usage: `>git remote`"
                );
            }

            return [
                "remote",
                "-v"
            ];

        case "show":
            if (args.length) {
                throw new Error(
                    "Usage: `>git show`"
                );
            }

            return [
                "show",
                "--stat"
            ];

        case "commit": {
            if (!args.length) {
                throw new Error(
                    'Usage: `>git commit "Your commit message"`'
                );
            }

            const message =
                args.join(" ").trim();

            if (!message) {
                throw new Error(
                    "Commit message cannot be empty."
                );
            }

            return [
                "commit",
                "-m",
                message
            ];
        }

        default:
            throw new Error(
                "Unsupported Git command."
            );
    }
}

/*
 * ============================================================
 * RUN GIT
 * ============================================================
 */

function runGit(
    args
) {
    return new Promise(
        resolve => {
            const child =
                spawn(
                    "git",
                    args,
                    {
                        cwd:
                            config.tools
                                .gitWorkingDirectory,

                        shell: false,

                        windowsHide: true
                    }
                );

            let stdout = "";
            let stderr = "";

            child.stdout.on(
                "data",
                data => {
                    stdout +=
                        data.toString();
                }
            );

            child.stderr.on(
                "data",
                data => {
                    stderr +=
                        data.toString();
                }
            );

            child.on(
                "error",
                error => {
                    resolve({
                        code: 1,

                        output:
                            error.message
                    });
                }
            );

            child.on(
                "close",
                code => {
                    resolve({
                        code:
                            code ?? 1,

                        output:
                            stdout ||
                            stderr
                    });
                }
            );
        }
    );
}

/*
 * ============================================================
 * DISCORD OUTPUT LIMIT
 * ============================================================
 */

function truncateOutput(
    output
) {
    if (
        output.length <=
        MAX_OUTPUT_LENGTH
    ) {
        return output;
    }

    return (
        output.slice(
            0,
            MAX_OUTPUT_LENGTH
        ) +
        "\n... output truncated ..."
    );
}