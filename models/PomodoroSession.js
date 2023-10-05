require('dotenv').config();
// const connection = require('../database/connection');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SelectMenuBuilder, ChannelType, PermissionsBitField } = require('discord.js');

class PomodoroSession {

    constructor(client, user, channel) {
        this.client = client;
        this.user = user;
        this.channel = channel;
        this.status = PomodoroStatus.ACTIVE;
        this.embedMessage = null;
        this.currentPhase = PomodoroPhase.FOCUS;
    }

    async CreateSession() {

        var embedMessage = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Estado de la sesión")
            // .setImage(this.user.avatarURL)
            .addFields(
                { name: "Fase", value: "Concentración", inline: true },
                { name: "Siguiente Fase", value: "Descanso Corto", inline: true },
                { name: "\u200B", value: "\u200B", inline: true },
                { name: "Progreso", value: "[XXX___________]", inline: true },
                { name: "\u200B", value: `39%`, inline: true },
                { name: "\u200B", value: "\u200B", inline: true },
                { name: "Información", value: "Si quieres invitar a alguien a participar en la sesión escribe \`/daracceso` en este mismo chat.\nEste canal de voz será eliminado una vez finalice o canceles la sesión.", inline: true },
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

        this.embedMessage = await this.client.channels.cache.get(this.channel.id).send({
            embeds: [embedMessage],
            components: [actionRow]
        })

    }

    static pauseSession() {
        this.status = PomodoroStatus.PAUSED;
    }

    static cancelSession(interaction) {
        
        this.status = PomodoroStatus.CANCELLED;
    }

    endSession() {
        this.room.delete();
        this.status = PomodoroStatus.ENDED;
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
    PomodoroPhase.LONG_BREAK
]




module.exports = PomodoroSession;