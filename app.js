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
const connection = require("./database/connection")
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
    if (interaction.isButton()) {

        if (interaction.customId === "resume") {
            await interaction.reply({
                content: "Reanudando la sesión...",
                ephemeral: true
            })

            connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE embed_message_id = '${interaction.message.id}' AND user_id = '${interaction.member.id}' AND (status = 0 OR status = 1)`,).then(rows => {
                if (rows.length > 0) {
                    interaction.editReply({
                        content: "Sesión reanudada correctamente.",
                        ephemeral: true
                    })

                    PomodoroSession.resumeSession(client, rows[0])
                    client.channels.fetch(rows[0].voice_channel_id).then(channel => {
                        channel.messages.fetch(rows[0].embed_message_id).then(message => {

                            message.edit({
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setCustomId("pause").setLabel("Pausar").setStyle(ButtonStyle.Primary).setEmoji("⏸️"),
                                        new ButtonBuilder().setCustomId("cancel").setLabel("Cancelar").setStyle(ButtonStyle.Danger).setEmoji("❌")
                                    )
                                ]
                            })
                        })
                    })
                } else {
                    interaction.editReply({
                        content: "No puedes reanudar esta sesión. Si crees que es un error, contacta con el administrador.",
                        ephemeral: true
                    })
                }
            }).catch(console.error)


            setTimeout(() => {
                interaction.deleteReply()
            }, 3000)
        }

        if (interaction.customId === "pause") {

            await interaction.reply({
                content: "Pausando la sesión...",
                ephemeral: true
            })

            connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE embed_message_id = '${interaction.message.id}' AND user_id = '${interaction.member.id}' AND (status = 0 OR status = 1)`,).then(rows => {
                if (rows.length > 0) {
                    interaction.editReply({
                        content: "Sesión pausada correctamente",
                        ephemeral: true
                    })

                    PomodoroSession.pauseSession(client, rows[0])
                    client.channels.fetch(rows[0].voice_channel_id).then(channel => {
                        channel.messages.fetch(rows[0].embed_message_id).then(message => {

                            message.edit({
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setCustomId("resume").setLabel("Reanudar").setStyle(ButtonStyle.Success).setEmoji("▶️"),
                                        new ButtonBuilder().setCustomId("cancel").setLabel("Cancelar").setStyle(ButtonStyle.Danger).setEmoji("❌")
                                    )
                                ]
                            })
                        })
                    })
                } else {
                    interaction.editReply({
                        content: "No puedes pausar esta sesión. Si crees que es un error, contacta con el administrador.",
                        ephemeral: true
                    })
                }
            }).catch(console.error)

            setTimeout(() => {
                interaction.deleteReply()
            }, 3000)
        }

        if (interaction.customId === "cancel") {
            await interaction.reply({
                content: "Cancelando la sesión...",
                ephemeral: true
            })

            connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE embed_message_id = '${interaction.message.id}' AND user_id = '${interaction.member.id}' AND (status = 0 OR status = 1)`,).then(rows => {
                if (rows.length > 0) {

                    if (rows[0].user_id !== interaction.member.id) {
                        interaction.editReply({
                            content: "No puedes cancelar una sesión que no es tuya.",
                            ephemeral: true
                        })
                        return
                    }

                    PomodoroSession.cancelSession(client, rows[0])
                } else {
                    interaction.editReply({
                        content: "No puedes cancelar esta sesión. Si crees que es un error, contacta con el administrador.",
                        ephemeral: true
                    })
                }
            }
            ).catch(console.error)

            setTimeout(() => {
                interaction.deleteReply()
            }, 3000)
        }
    }

})

client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.channelId === process.env.DISCORD_VOICECHANNEL_CREATEROOM) {
        connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE user_id = "${newState.member.id}" AND status = 0 OR status = 1`,).then(rows => {
            if (rows.length > 0) {
                console.log(newState.member.displayName + " ya tiene una sesión activa")
                //TODO: Send message to user and cancel event
                return
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
                    newState.member.voice.setChannel(channel)
                    const pomodoroSession = new PomodoroSession(client, newState.member, channel);
                    pomodoroSession.CreateSession();

                    return channel
                }).catch(console.error)
            }
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
