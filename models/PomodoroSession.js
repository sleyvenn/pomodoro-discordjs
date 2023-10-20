require('dotenv').config();
const dbConnection = require('../database/connection');
const timerConverter = require('../utils/timerConverter');
const formatDateToSQL = require('../utils/formatDate');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource } = require("@discordjs/voice");
const PomodoroConfig = require('../models/PomodoroConfig');


class PomodoroSession {

    constructor(client, user, voiceChannel) {
        this.client = client;
        this.user = user;
        this.voiceChannel = voiceChannel;
    }

    startPomodoro() {
        this.status = PomodoroConfig.STATUS.ACTIVE;
        this.currentPhaseIndex = 0;
        this.currentPhase = PomodoroConfig.PHASES.FOCUS;

        const connection = new dbConnection();
        connection.query('INSERT INTO pomodoro_sessions (user_id, voice_channel_id, status, start_time) VALUES (?, ?, ?, ?)', [this.user.id, this.voiceChannel.id, this.status, formatDateToSQL(new Date())]).then(rows => {
            this.id = rows.insertId;
            this.createEmbedMessage();
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
                case PomodoroConfig.STATUS.ACTIVE:
                    if (this.remainingTime <= 0) {
                        this.nextPhase();
                    } else {
                        if (this.remainingTime % 15000 === 0) this.updateEmbedMessage();
                    }
                    break;
                case PomodoroConfig.STATUS.PAUSED:
                    this.updateEmbedMessage();
                    clearInterval(this.timer);
                    break;
                case PomodoroConfig.STATUS.CANCELLED:
                    clearInterval(this.timer);
                    break;
                default:
                    break;
            }

        }, 1000);
    }

    pausePomodoro() {
        this.status = PomodoroConfig.STATUS.PAUSED;
        this.updateEmbedMessage();
        clearInterval(this.timer);
        this.client.users.cache.get(this.user.id).send({ content: "Pomodoro pausado." });
        var pausedRemainingTime = timerConverter.minToMs(30);
        this.pausedTimer = setInterval(() => {
            pausedRemainingTime -= 6000;

            switch (pausedRemainingTime) {
                case timerConverter.minToMs(10):
                    this.client.users.cache.get(this.user.id).send({ content: "La sesión lleva pausada 20 minutos. Si no reanudas la sesión en 10 minutos se cancelará." });
                case timerConverter.minToMs(5):
                    this.client.users.cache.get(this.user.id).send({ content: "Si no reanudas la sesión en 5 minutos se cancelará." });
                    break;
                case timerConverter.minToMs(1):
                    console.log("hola!")
                    this.client.users.cache.get(this.user.id).send({ content: "Si no reanudas la sesión en 1 minuto se cancelará." });
                    break;
                case 0:
                    this.cancelPomodoro();
                    clearInterval(pausedTimer);
                default:
                    break;
            }

        }, 6000);
        return true;
    }

    resumePomodoro() {
        clearInterval(this.pausedTimer)
        this.status = PomodoroConfig.STATUS.ACTIVE;
        this.startTimer(this.remainingTime);
        this.client.users.cache.get(this.user.id).send({ content: "Pomodoro reanudado." });
        this.updateEmbedMessage();
        return true;
    }

    cancelPomodoro() {
        clearInterval(this.timer);
        const connection = new dbConnection();
        connection.query('UPDATE pomodoro_sessions SET status = ?, end_time = ? WHERE id = ?', [PomodoroConfig.STATUS.CANCELLED, formatDateToSQL(new Date()), this.id]).then(() => {
            this.status = PomodoroConfig.STATUS.CANCELLED;
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
        connection.query('UPDATE pomodoro_sessions SET status = ?, end_time = ? WHERE id = ?', [PomodoroConfig.STATUS.ENDED, formatDateToSQL(new Date()), this.id]).then(() => {
            this.status = PomodoroConfig.STATUS.ENDED;
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
        this.currentPhase = PomodoroConfig.PHASE_ORDER[this.currentPhaseIndex];

        if (this.currentPhaseIndex === PomodoroConfig.PHASE_ORDER.length - 1) {
            this.endPomodoro();
        }

        else {
            this.voiceChannelAlert();
            this.updateEmbedMessage();
            this.remainingTime = timerConverter.minToMs(this.currentPhase.duration);

            switch (this.currentPhase) {
                case PomodoroConfig.PHASES.FOCUS:
                    this.client.users.cache.get(this.user.id).send({ content: PomodoroConfig.FOCUS_PHRASES[Math.floor(Math.random() * PomodoroConfig.FOCUS_PHRASES.length)] });
                    break;
                case PomodoroConfig.PHASES.SHORT_BREAK:
                    this.client.users.cache.get(this.user.id).send({ content: PomodoroConfig.SHORT_BREAK_PHRASES[Math.floor(Math.random() * PomodoroConfig.SHORT_BREAK_PHRASES.length)] });
                    break;
                case PomodoroConfig.PHASES.LONG_BREAK:
                    this.client.users.cache.get(this.user.id).send({ content: PomodoroConfig.LONG_BREAK_PHRASES[Math.floor(Math.random() * PomodoroConfig.LONG_BREAK_PHRASES.length)] });
                    break;
                default:
                    break;
            }
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
                .addFields(
                    { name: "Fase", value: this.currentPhase.name, inline: true },
                    { name: "Siguiente Fase", value: PomodoroConfig.PHASE_ORDER[this.currentPhaseIndex + 1]?.name ?? "Fin", inline: true },
                    {
                        name: "Información",
                        value:
                            "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                            "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                        inline: false
                    },
                    { name: "Progreso", value: `${this.fillProgressBar(percentage)} - ${percentage}%`, inline: true },
                )
                .setTimestamp()
            var actionRow = new ActionRowBuilder()
            if (this.status === PomodoroConfig.STATUS.PAUSED) {
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
            .addFields(
                { name: "Fase", value: this.currentPhase.name, inline: true },
                { name: "Siguiente Fase", value: PomodoroConfig.PHASE_ORDER[this.currentPhaseIndex + 1].name || "Fin", inline: true },
                {
                    name: "Información",
                    value:
                        "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat." +
                        "\nEste canal de voz será eliminado una vez finalice o canceles la sesión.",
                    inline: false
                },
                { name: "Progreso", value: `${this.fillProgressBar(0)} - 0%`, inline: true },
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

    fillProgressBar(percentage) {
        const progressBarEmpty = PomodoroConfig.EMOJIS_BAR.FIRST_EMPTY + PomodoroConfig.EMOJIS_BAR.MIDDLE_EMPTY.repeat(8) + PomodoroConfig.EMOJIS_BAR.LAST_EMPTY;

        var filled = Math.round(percentage / 10);

        if (filled === 0 || filled > 10) {
            return progressBarEmpty;
        }

        else if (filled === 1) {
            return PomodoroConfig.EMOJIS_BAR.FIRST_FULL + PomodoroConfig.EMOJIS_BAR.MIDDLE_EMPTY.repeat(8) + PomodoroConfig.EMOJIS_BAR.LAST_EMPTY;
        }

        else if (filled > 1 && filled <= 9) {
            return PomodoroConfig.EMOJIS_BAR.FIRST_FULL + PomodoroConfig.EMOJIS_BAR.MIDDLE_FULL.repeat(filled - 1) + PomodoroConfig.EMOJIS_BAR.MIDDLE_EMPTY.repeat(9 - filled) + PomodoroConfig.EMOJIS_BAR.LAST_EMPTY;
        }

        else if (filled === 10) {
            return PomodoroConfig.EMOJIS_BAR.FIRST_FULL + PomodoroConfig.EMOJIS_BAR.MIDDLE_FULL.repeat(8) + PomodoroConfig.EMOJIS_BAR.LAST_FULL;
        }
    }

}


module.exports = PomodoroSession;