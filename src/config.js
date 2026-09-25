export default {
    bot: {
        status: "Idle",
        activityType: "WATCHING",
        prefix: ">"
    },
    presence: {
        apiUrl:
            "https://astra-presence.impartial-peacock.workers.dev/v1/online",

        updateInterval:
            60_000
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
    applications: {
        enabled: true,
        channelId: "1551983074361741443",
        panelColor: 0x00AEFF,
        applicationColor: 0x00FF7F,
        questionTimeout: 5 * 60 * 1000,
        command: "applicationmessage",
        questions_staff: [
            "What is your timezone?",
            "How active are you on this server? (hours per day / week)",
            "Why do you want to join the staff team?",
            "What would you do if two people are arguing in chat?",
            "Do you have any previous staff experience? If yes, where?",
            "How would you handle a user who keeps breaking rules after multiple warnings?",
            "What do you think is the most important quality of a staff member?",
            "How long have you been in this server and how did you find it?"
        ]
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