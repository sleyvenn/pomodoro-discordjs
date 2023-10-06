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
const Timeout = new Set()
const humanizeDuration = require("humanize-duration")

const PomodoroContainer = require('./models/PomodoroContainer');
const PomodoroSession = require('./models/PomodoroSession');


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
    if (interaction.isButton()) {
        switch (interaction.customId) {
            case "resume":
                await interaction.reply({ content: "Reanudando pomodoro...", ephemeral: true })
                if (PomodoroContainer.getPomodoroSessionByUser(interaction.user).resumePomodoro()) {
                    await interaction.editReply({ content: "Pomodoro reanudado.", ephemeral: true })
                }

                setTimeout(() => {
                    interaction.deleteReply();
                }, 5000);

                break;
            case "pause":
                await interaction.reply({ content: "Pausando pomodoro...", ephemeral: true })
                if (PomodoroContainer.getPomodoroSessionByUser(interaction.user).pausePomodoro()) {
                    await interaction.editReply({ content: "Pomodoro pausado.", ephemeral: true })
                }

                setTimeout(() => {
                    interaction.deleteReply();
                }, 5000);

                break;
            case "cancel":
                await interaction.reply({ content: "Cancelando pomodoro...", ephemeral: true })
                const pomodoroSession = PomodoroContainer.getPomodoroSessionByUser(interaction.user);
                PomodoroContainer.removePomodoroSession(pomodoroSession);
                if (pomodoroSession.cancelPomodoro()) {
                    await interaction.editReply({ content: "Pomodoro cancelado.", ephemeral: true })
                }
                break;
            default:
                break;
        }
    }

    else if (interaction.isCommand() || interaction.isContextMenu()) {

        if (!client.slash.has(interaction.commandName)) return
        if (!interaction.guild) return

        const command = client.slash.get(interaction.commandName)

        try {
            if (command.timeout) {
                if (Timeout.has(`${interaction.user.id}${command.name}`)) {
                    return interaction.reply({ content: `Tienes que esperar **${humanizeDuration(command.timeout, { round: true })}** para usar el comando otra vez.`, ephemeral: true })
                }
            }
            if (command.permissions) {
                if (!interaction.member.permissions.has(command.permissions)) {
                    return interaction.reply({ content: `:x: Necesitas \`${command.permissions}\` para usar este comando.`, ephemeral: true })
                }
            }
            command.run(interaction, client)
            Timeout.add(`${interaction.user.id}${command.name}`)
            setTimeout(() => {
                Timeout.delete(`${interaction.user.id}${command.name}`)
            }, command.timeout)
        } catch (error) {
            console.error(error)
            await interaction.reply({ content: ":x: Ha habido algún error al ejecutar el comando.", ephemeral: true })
        }
    }

})

client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.channelId === process.env.DISCORD_VOICECHANNEL_CREATEROOM) {
        var pomodoroSession = PomodoroContainer.getPomodoroSessionByUser(newState.member.user);
        if (pomodoroSession !== undefined) {
            client.channels.fetch(pomodoroSession.voiceChannel.id).then(channel => {
                newState.setChannel(channel);
            })
        } else {
            newState.guild.channels.create({
                name: `Sesión de ${newState.member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: process.env.DISCORD_CATEGORY_ID,
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
                pomodoroSession = new PomodoroSession(client, newState.member.user, channel)

                pomodoroSession.startPomodoro();
                PomodoroContainer.addPomodoroSession(pomodoroSession);
                newState.setChannel(channel);

            })
        }
    }
}),

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
