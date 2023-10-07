require('dotenv').config();
const dbConnection = require('../database/connection');
const timerConverter = require('../utils/timerConverter');
const formatDateToSQL = require('../utils/formatDate');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource } = require("@discordjs/voice");
const PomodoroContainer = require('../models/PomodoroContainer');

class PomodoroSession {

    constructor(client, user, voiceChannel) {
        this.id = null;
        this.client = client;
        this.user = user;
        this.voiceChannel = voiceChannel;
        this.status = PomodoroStatus.ACTIVE;
        this.embedMessage = null;
        this.currentPhase = PomodoroPhase.FOCUS;
        this.currentPhaseIndex = 0;
    }

    startPomodoro() {
        this.status = PomodoroStatus.ACTIVE;
        this.currentPhaseIndex = 0;
        this.currentPhase = PomodoroPhaseOrder[this.currentPhaseIndex];

        const connection = new dbConnection();
        connection.query('INSERT INTO pomodoro_sessions (user_id, voice_channel_id, status, start_time) VALUES (?, ?, ?, ?)', [this.user.id, this.voiceChannel.id, this.status, formatDateToSQL(new Date())]).then(rows => {
            this.id = rows.insertId;
            this.startTimer();
            connection.close();
            this.client.users.cache.get(this.user.id).send({ content: "Inicia la sesión Pomodoro." });
            this.client.channels.cache.get(process.env.DISCORD_VOICECHANNEL_CREATEROOM).send({ content: `**${this.user.displayName}** ha iniciado una sesión Pomodoro.` });
        }).catch(err => {
            console.log(err);
            connection.close();
        });

    }

    startTimer(remainingTime = null) {
        this.remainingTime = remainingTime || timerConverter.minToMs(this.currentPhase.duration);

        this.timer = setInterval(() => {
            this.remainingTime -= 1000;

            switch (this.status) {
                case PomodoroStatus.ACTIVE:
                    if (this.remainingTime <= 0) {
                        this.nextPhase();
                    } else {
                        this.updateEmbedMessage();
                    }
                    break;
                case PomodoroStatus.PAUSED:
                    this.updateEmbedMessage();
                    clearInterval(this.timer);
                    break;
                case PomodoroStatus.CANCELLED:
                    this.voiceChannel.delete();
                    clearInterval(this.timer);
                    break;
                default:
                    break;
            }

        }, 1000);
    }

    pausePomodoro() {
        this.status = PomodoroStatus.PAUSED;
        clearInterval(this.timer);
        this.updateEmbedMessage();
        this.client.users.cache.get(this.user.id).send({ content: "Pomodoro pausado." });

        return true;
    }

    resumePomodoro() {
        this.status = PomodoroStatus.ACTIVE;
        this.startTimer(this.remainingTime);
        this.client.users.cache.get(this.user.id).send({ content: "Pomodoro reanudado." });
        return true;
    }

    cancelPomodoro() {
        clearInterval(this.timer);
        const connection = new dbConnection();
        connection.query('UPDATE pomodoro_sessions SET status = ?, end_time = ? WHERE id = ?', [PomodoroStatus.CANCELLED, formatDateToSQL(new Date()), this.id]).then(() => {
            this.status = PomodoroStatus.CANCELLED;
            this.voiceChannel.delete();
            connection.close();
            this.client.users.cache.get(this.user.id).send({ content: "Pomodoro cancelado." });

            return true;
        }).catch(err => {
            console.log(err);
            connection.close();
        });

        return false;
    }

    endPomodoro() {
        const connection = new dbConnection();
        connection.query('UPDATE pomodoro_sessions SET status = ?, end_time = ? WHERE id = ?', [PomodoroStatus.ENDED, formatDateToSQL(new Date()), this.id]).then(() => {
            this.status = PomodoroStatus.ENDED;
            clearInterval(this.timer);
            this.voiceChannel.delete();
            this.updateEmbedMessage();
            connection.close();
            this.client.pomodoroContainer.removePomodoroSession(this);
            this.client.users.cache.get(this.user.id).send({ content: "Pomodoro finalizado." });
        }).catch(err => {
            console.log(err);
            connection.close();
        });
    }

    nextPhase() {
        this.currentPhaseIndex++;
        this.currentPhase = PomodoroPhaseOrder[this.currentPhaseIndex];

        if (this.currentPhaseIndex === PomodoroPhaseOrder.length - 1) {
            this.endPomodoro();
        }

        else {
            this.voiceChannelAlert();
            this.updateEmbedMessage();
            this.remainingTime = timerConverter.minToMs(this.currentPhase.duration);
            this.client.users.cache.get(this.user.id).send({ content: "Ha comenzado la fase de **" + this.currentPhase.name + "**." });
        }
    }

    updateEmbedMessage() {
        if (this.embedMessage === null) {
            this.createEmbedMessage();
        }

        else {
            var percentage = Math.round((this.currentPhase.duration * 60 * 1000 - this.remainingTime) / (this.currentPhase.duration * 60 * 1000) * 100);

            var embedMessage = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("Estado de la sesión")
                // .setImage(this.user.avatarURL)
                .addFields(
                    { name: "Fase", value: this.currentPhase.name, inline: true },
                    { name: "Siguiente Fase", value: PomodoroPhaseOrder[this.currentPhaseIndex + 1]?.name ?? "Fin", inline: true },
                    {
                        name: "Información",
                        value:
                            "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                            "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                        inline: false
                    },
                    { name: "Progreso", value: `${fillProgressBar(percentage)} - ${percentage}%`, inline: true },
                )
                .setTimestamp()
            var actionRow = new ActionRowBuilder()
            if (this.status === PomodoroStatus.PAUSED) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId("resume")
                        .setLabel("Reanudar")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("▶️")
                )
            } else {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId("pause")
                        .setLabel("Pausar")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("⏸️")
                )
            }

            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId("cancel")
                    .setLabel("Cancelar")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("❌")
            )

            this.embedMessage.edit({
                embeds: [embedMessage],
                components: [actionRow]
            }).catch(err => {
                console.log(err);
            });
        }
    }

    createEmbedMessage() {
        var embedMessage = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Estado de la sesión")
            // .setImage(this.user.avatarURL)
            .addFields(
                { name: "Fase", value: this.currentPhase.name, inline: true },
                { name: "Siguiente Fase", value: PomodoroPhaseOrder[this.currentPhaseIndex + 1].name || "Fin", inline: true },
                {
                    name: "Información",
                    value:
                        "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                        "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                    inline: false
                },
                { name: "Progreso", value: `${fillProgressBar()} - 0%`, inline: true },
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

        this.client.channels.cache.get(this.voiceChannel.id).send({
            embeds: [embedMessage],
            components: [actionRow]
        }).then(message => {
            const connection = new dbConnection();
            connection.query('UPDATE pomodoro_sessions SET embed_message_id = ? WHERE id = ?', [message.id, this.id]).then(() => {
                this.embedMessage = message;
                connection.close();
            }).catch(err => {
                console.log(err);
                connection.close();
            });

        }).catch(err => {
            console.log(err);
        });
    }

    voiceChannelAlert() {
        //check if voice channel has users connected
        if (this.voiceChannel.members.size === 0) return;

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

}

function fillProgressBar(percentage = 0) {
    const progressBarEmpty = PomodoroEmojisBar.FIRST_EMPTY + PomodoroEmojisBar.MIDDLE_EMPTY.repeat(8) + PomodoroEmojisBar.LAST_EMPTY;

    var filled = Math.round(percentage / 10);

    if (filled === 0 || filled > 10) {
        return progressBarEmpty;
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
        duration: 10
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



module.exports = PomodoroSession;