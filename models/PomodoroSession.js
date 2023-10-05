require('dotenv').config();
const connection = require('../database/connection');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SelectMenuBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource } = require("@discordjs/voice");

const formatDateToSQL = require('../utils/formatDate');
const timerConverter = require('../utils/timerConverter');

class PomodoroSession {

    constructor(client, user, voiceChannel) {
        this.client = client;
        this.user = user;
        this.voiceChannel = voiceChannel;
        this.status = PomodoroStatus.ACTIVE;
        this.embedMessage = null;
        this.currentPhase = PomodoroPhase.FOCUS;
        this.currentPhaseIndex = 0;
    }

    async CreateSession() {

        var embedMessage = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Estado de la sesión")
            // .setImage(this.user.avatarURL)
            .addFields(
                { name: "Fase", value: "Concentración", inline: true },
                { name: "Siguiente Fase", value: "Descanso Corto", inline: true },
                {
                    name: "Información",
                    value:
                        "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                        "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                    inline: false
                },
                { name: "Progreso", value: progressBarEmpty, inline: true },
            )
            .setTimestamp()

        var actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("pause")
                    .setLabel("Pausar")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("⏸️"),
                new ButtonBuilder()
                    .setCustomId("cancel")
                    .setLabel("Cancelar")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("❌")
            )

        this.embedMessage = await this.client.channels.cache.get(this.voiceChannel.id).send({
            embeds: [embedMessage],
            components: [actionRow]
        })

        connection.executeSQLTransaction(`INSERT INTO pomodoro_sessions (user_id, voice_channel_id, embed_message_id, status, start_time, remaining_time) VALUES ('${this.user.id}', '${this.voiceChannel.id}', '${this.embedMessage.id}', 0, '${formatDateToSQL(new Date())}', '${timerConverter.minToMs(25)}')`).then(rows => {
            console.log("Sesión creada para " + this.user.displayName)
            this.id = rows.insertId;
            this.startSession();
        }).catch(console.error)

    }

    startSession() {
        this.countdown();
        this.client.users.cache.get(this.user.id).send({ content: "Tu sesión Pomodoro ha comenzado." })
        this.client.users.cache.get(this.user.id).send({ content: "Te he movido al canal de voz de tu sesión. Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat o en el canal de texto de la sesión." })
        this.client.users.cache.get(this.user.id).send({ content: "Si quieres pausar la sesión escribe \`/pausar` en este mismo chat o hacer clic en el botón de pausa. Si quieres cancelar la sesión escribe \`/cancelar` en este mismo chat o hacer clic en el botón de cancelar." })
    }

    countdown() {
        this.remainingTimeMS = timerConverter.minToMs(this.currentPhase.duration);

        connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET remaining_time = '${this.remainingTimeMS}', current_phase = '${this.currentPhaseIndex}' WHERE id = '${this.id}'`).then(rows => {
            console.log("Tiempo actualizado para " + this.user.displayName + " a " + this.remainingTimeMS + "ms en la base de datos y a la fase " + this.currentPhaseIndex + " de la sesión")
        }).catch(console.error)

        this.updateEmbed();

        var interval = setInterval(() => {

            if (this.status === PomodoroStatus.CANCELLED) {
                clearInterval(interval);
                this.endSession();
            }
            connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE id = '${this.id}'`).then(rows => {
                if (rows[0].status === 1) {
                    this.status = PomodoroStatus.PAUSED;
                } else if (rows[0].status === 3) {
                    this.status = PomodoroStatus.CANCELLED;
                }
            }).catch(console.error)

            if (this.status === PomodoroStatus.ACTIVE && this.remainingTimeMS > 0) {
                this.remainingTimeMS -= 6000;
                connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET remaining_time = '${this.remainingTimeMS}', current_phase = '${this.currentPhaseIndex}' WHERE id = '${this.id}'`).then(rows => {

                }).catch(console.error)

                connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE id = '${this.id}'`).then(rows => {
                    if (rows[0].status === 1) {
                        this.status = PomodoroStatus.PAUSED;
                    } else if (rows[0].status === 3) {
                        this.status = PomodoroStatus.CANCELLED;
                    }
                }).catch(console.error)

                if (this.status != PomodoroStatus.CANCELLED) {
                    this.updateEmbed();
                }
            }

            else if (this.status === PomodoroStatus.PAUSED) {
                connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE id = '${this.id}'`).then(rows => {
                    this.pausedAt = rows[0].updated_at;

                }).catch(console.error)

                var pausedInterval = setInterval(() => {
                    connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE id = '${this.id}'`).then(rows => {
                        if (rows[0].status === 3) {
                            this.status = PomodoroStatus.CANCELLED;
                            clearInterval(pausedInterval);
                        } else if (rows[0].status === 0) {
                            this.status = PomodoroStatus.ACTIVE;
                            clearInterval(pausedInterval);

                        } else if (rows[0].status === 1) {
                            this.status = PomodoroStatus.PAUSED;
                        }

                        var pausedTime = new Date() - this.pausedAt;

                        if (pausedTime > 1800000) {
                            this.status = PomodoroStatus.CANCELLED;
                            this.client.users.cache.get(this.user.id).send({ content: "Tu sesión Pomodoro ha sido cancelada." })
                            clearInterval(pausedInterval);
                        }

                        else if (pausedTime > 1740000) {
                            this.client.users.cache.get(this.user.id).send({ content: "Tu sesión Pomodoro será cancelada en 1 minuto si no la reanudas." })
                        }

                        else if (pausedTime > 1500000) {
                            this.client.users.cache.get(this.user.id).send({ content: "Tu sesión Pomodoro será cancelada en 5 minutos si no la reanudas." })
                        }

                        else if (pausedTime > 1200000) {
                            this.client.users.cache.get(this.user.id).send({ content: "Tu sesión Pomodoro será cancelada en 10 minutos si no la reanudas." })
                        }
                    }).catch(console.error)
                }, 1000)

            }

            else if (this.remainingTimeMS === 0) {
                clearInterval(interval);
                this.nextPhase();
            }
        }, 6000);
    }

    updateEmbed() {
        if (this.status !== PomodoroStatus.CANCELLED) {


            var embedMessage = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("Estado de la sesión")
                // .setImage(this.user.avatarURL)
                .addFields(
                    { name: "Fase", value: this.currentPhase.name, inline: true },
                    { name: "Siguiente Fase", value: PomodoroPhaseOrder[this.currentPhaseIndex + 1].name ?? "Fin", inline: true },
                    {
                        name: "Información",
                        value:
                            "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                            "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                        inline: false
                    },
                    { name: "Progreso", value: fillProgressBar(Math.round((this.currentPhase.duration - timerConverter.msToMin(this.remainingTimeMS)) / this.currentPhase.duration * 100)) + ` - ${Math.round((this.currentPhase.duration - timerConverter.msToMin(this.remainingTimeMS)) / this.currentPhase.duration * 100)}%`, inline: true },
                    // { name: "\u200B", value: "\u200B", inline: true },
                )
                .setTimestamp()

            this.embedMessage.edit({
                embeds: [embedMessage]
            }).then(() => {
            }
            ).catch(console.error)


        }
    }

    nextPhase() {
        this.currentPhaseIndex += 1;
        if (this.currentPhaseIndex === PomodoroPhaseOrder.length - 1) {
            this.endSession();
        } else {
            this.currentPhase = PomodoroPhaseOrder[this.currentPhaseIndex];
            this.updateEmbed();
            this.voiceChannelAlert();
            this.client.users.cache.get(this.user.id).send({ content: "La fase de" + this.currentPhase.name + "ha comenzado." })
            this.countdown();
        }
    }

    voiceChannelAlert() {
        const connection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.voiceChannel.guild.id,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource('./assets/calm.mp3');
        player.play(resource);
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });
    }

    endSession() {
        //if this.voicechannel exists delete it
        if (this.voiceChannel !== null) this.voiceChannel.delete();
        this.status = PomodoroStatus.ENDED;
        connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET status = 2, current_phase = 8, end_time = '${formatDateToSQL(new Date())}' WHERE id = '${this.id}'`).then(rows => {
            console.log("Sesión finalizada para " + this.user.displayName)
        }).catch(console.error)
    }

    static resumeSession(client, pomodoroSession) {
        connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET status = 0 WHERE id = '${pomodoroSession.id}'`).then(rows => {
            console.log("Sesión con id " + pomodoroSession.id + " reanudada.")
            client.users.cache.get(pomodoroSession.user_id).send({ content: "Tu sesión Pomodoro ha sido reanudada." })
        }).catch(console.error)
    }

    static pauseSession(client, pomodoroSession) {
        connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET status = 1 WHERE id = '${pomodoroSession.id}'`).then(rows => {
            console.log("Sesión con id " + pomodoroSession.id + " pausada.")
            client.users.cache.get(pomodoroSession.user_id).send({ content: "Tu sesión Pomodoro ha sido pausada." })
        }).catch(console.error)
    }

    static cancelSession(client, pomodoroSession) {
        connection.executeSQLTransaction(`UPDATE pomodoro_sessions SET status = 3, end_time = '${formatDateToSQL(new Date())}' WHERE id = '${pomodoroSession.id}'`).then(rows => {
            console.log("Sesión con id " + pomodoroSession.id + " cancelada.")
            client.users.cache.get(pomodoroSession.user_id).send({ content: "Tu sesión Pomodoro ha sido cancelada." })
        }).catch(console.error)

        client.channels.cache.get(pomodoroSession.voice_channel_id).delete();
        this.voiceChannel = null;
    }

}

function fillProgressBar(percentage) {
    var filled = Math.round(percentage / 10);

    if (filled === 0 || filled > 10) {
        return PomodoroEmojisBar.FIRST_EMPTY + PomodoroEmojisBar.MIDDLE_EMPTY.repeat(8) + PomodoroEmojisBar.LAST_EMPTY;
    }

    else if (filled === 1) {
        return PomodoroEmojisBar.FIRST_FULL + PomodoroEmojisBar.MIDDLE_EMPTY.repeat(8) + PomodoroEmojisBar.LAST_EMPTY;
    }

    else if (filled > 1 && filled <= 9) {
        return PomodoroEmojisBar.FIRST_FULL + PomodoroEmojisBar.MIDDLE_FULL.repeat(filled - 1) + PomodoroEmojisBar.MIDDLE_EMPTY.repeat(9 - filled) + PomodoroEmojisBar.LAST_EMPTY;
    }

    else if (filled === 10) {
        return PomodoroEmojisBar.FIRST_FULL + PomodoroEmojisBar.MIDDLE_FULL.repeat(8) + PomodoroEmojisBar.LAST_FULL;
    }

}

const PomodoroStatus = {
    ACTIVE: 0,
    PAUSED: 1,
    ENDED: 2,
    CANCELLED: 3
}

const PomodoroPhase = {
    FOCUS: {
        name: "Concentración",
        duration: 25
    },
    SHORT_BREAK: {
        name: "Descanso Corto",
        duration: 5
    },
    LONG_BREAK: {
        name: "Descanso Largo",
        duration: 15
    },
    END: {
        name: "Fin",
        duration: 0
    }
}

const PomodoroPhaseOrder = [
    PomodoroPhase.FOCUS,
    PomodoroPhase.SHORT_BREAK,
    PomodoroPhase.FOCUS,
    PomodoroPhase.SHORT_BREAK,
    PomodoroPhase.FOCUS,
    PomodoroPhase.SHORT_BREAK,
    PomodoroPhase.FOCUS,
    PomodoroPhase.LONG_BREAK,
    PomodoroPhase.END
]

const PomodoroEmojisBar = {
    FIRST_EMPTY: "<:bar1:1096134440377385180>",
    FIRST_FULL: "<:bar2:1096134442302570586>",
    MIDDLE_EMPTY: "<:bar5:1096134446937276497>",
    MIDDLE_FULL: "<:bar6:1096134448438845470>",
    LAST_EMPTY: "<:bar3:1096134443623792791>",
    LAST_FULL: "<:bar4:1096134444944998552>"
}

const progressBarEmpty = PomodoroEmojisBar.FIRST_EMPTY + PomodoroEmojisBar.MIDDLE_EMPTY.repeat(8) + PomodoroEmojisBar.LAST_EMPTY;


module.exports = PomodoroSession;