export default {
    bot: {
        status: "Online",
        activityType: "STREAMING",
        prefix: ">"
    },
    presence: {
        apiUrl:
            "https://astra-presence.impartial-peacock.workers.dev/v1/online",

        updateInterval:
            25_000
    },
    /*
    {user}              Username  
    {username}          
    {server}            
    {memberCount}       
    */
    welcome: {
        enabled: true,

        title: "👋 Welcome to {server}!",

        color: 0x2EAE74,

        message: [
            "**{server}** is a **performance-focused** Minecraft client + launcher built for speed and simplicity — title screen in about 2–3 seconds.",
            "",
            "🚀 Get Astra:",
            "https://elkku01.github.io/astra-website/",
            "",
            "🆘 Need help with anything?",
            "<#1551290965237571585>"
        ].join("\n"),

        footer: "Thanks for joining!"
    },
    moderation: {
        moderatorRoleId: "1552206316540534814",
        logChannelId: "1551655533185077279",
        dmUsers: true,
        maxWarnings: 3,
        autoTimeoutAfterWarnings: true,
        autoTimeoutDuration: 60 * 60 * 1000,
        deleteCommandMessages: false
    },
    tickets: {
        enabled: true,
        supportRoleId: "1551911590536937523",
        categoryId: "1551980883488145438",
        logChannelId: "1551975698535546931",
        transcriptChannelId: "",
        maximumOpenTickets: 2,
        nameFormat: "ticket-{username}",
        closeAfterHours: 48,
        allowUserClose: false,
        deleteAfterClose: false,
        ticketColor: 0x5865F2
    },
    emailSupport: {
        enabled: true,
        mailboxEmail: "support.astraclient@gmail.com",
        channelId: "",
        staffRoleId: "",
        pollInterval: 60_000
    },
    applications: {
        enabled: true,
        channelId: "1551983074361741443",
        panelColor: 0x00AEFF,
        applicationColor: 0x00FF7F,
        questionTimeout: 5 * 60 * 1000,

        /*
         * Role that can review applications (buttons,
         * >approve, >deny). Members with Manage Server
         * can always review. Leave empty for Manage
         * Server only.
         */
        reviewerRoleId: "1553084713701343264"
        /*
         * Applications themselves (name, description, questions)
         * are managed in Discord:
         *   >applicationcreate, >applicationsend,
         *   >applicationlist, >applicationremove
         */
    },
    tools: {
        authorizedUserIds: [
            "813018037632237568",
            "797752390680838174"
        ],

        /*
        * Directory containing the Git repository.
        *
        * Example:
        * "C:/Users/USER/Desktop/astra-discord-bot"
        */
        gitWorkingDirectory:
            "C:/Users/vtkvi/Desktop/astra-discord-bot"
    },
    embeds: {
        color: 0x5865F2,
        errorColor: 0xED4245,
        successColor: 0x57F287,
        warningColor: 0xFEE75C
    }
};