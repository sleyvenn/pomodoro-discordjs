const Discord = require("discord.js")
require("dotenv").config()
const { Client, GatewayIntentBits, ActivityType, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
})

const { readdirSync } = require("fs")
const moment = require("moment")
moment.locale('es')
client.slash = new Discord.Collection()
const { REST } = require("@discordjs/rest")
const { Routes } = require("discord-api-types/v9")
const path = require("path")
const commands = []
// const connection = require("./database/connection")

const PomodoroSession = require("./models/PomodoroSession");

readdirSync("./commands/").map(async dir => {
    readdirSync(`./commands/${dir}/`).map(async (cmd) => {
        commands.push(require(path.join(__dirname, `./commands/${dir}/${cmd}`)))
    })
})
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.BOT_ID),
            { body: commands }
        )
        console.log("\x1b[34m%s\x1b[0m", "Successfully reloaded application (/) commands.")
    } catch (error) {
        console.error(error)
    }
})();

["slash", "anticrash"].forEach(handler => {
    require(`./handlers/${handler}`)(client)
})

client.on("ready", () => {
    console.log("\x1b[34m%s\x1b[0m", `Conectado como ${client.user.tag}!`)

    client.user.setPresence({
        activities: [{ name: "Pomodoro", type: ActivityType.Playing }],
        status: 'idle',
    });
})

client.on("interactionCreate", async (interaction) => {

    //if is button
    if (interaction.isButton()) {
        if (interaction.customId === "pause") {
            interaction.reply({
                content: "Pausado",
                ephemeral: true
            })
        }
        if (interaction.customId === "cancel") {
            
            PomodoroSession.cancelSession(interaction)
        }
    }

})

client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.channelId === process.env.DISCORD_VOICECHANNEL_CREATEROOM) {
        // connection.executeSQLTransaction("SELECT * FROM pomodoro_sessions WHERE user_id = ? AND (status = 0 OR status = 1)", [newState.member.id]).then(rows => {
        //     if (rows.length < 0) {
        //         return
        //     }
        // }).catch(console.error)

        const newRoom = newState.guild.channels.create({
            name: `Sesión de ${newState.member.displayName}`,
            type: ChannelType.GuildVoice,
            parent: "929292689361485827",
            bitrate: 64000,
            permissionOverwrites: [
                {
                    id: newState.member.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
                },
                {
                    id: newState.guild.roles.everyone.id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                    deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
                },
            ],
        }).then(channel => {
            newState.member.voice.setChannel(channel)
            
            const pomodoroSession = new PomodoroSession(client, newState.member, channel);

            pomodoroSession.CreateSession();
                        
            return channel

        }).catch(console.error)
        
    }
})

client.on("guildCreate", guild => {

})
client.on("guildDelete", guild => {

})

if (!process.env.TOKEN) {
    console.error("[ERROR]", "Token not found please visit: https://discord.com/developers/application to get token")
    process.exit(0)
}
client.login(process.env.TOKEN)

process.on("SIGINT", () => {
    console.log("\x1b[36m%s\x1b[0m", "SIGINT detected, exiting...")
    process.exit(0)
})
