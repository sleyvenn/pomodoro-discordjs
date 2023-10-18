module.exports = {
    name: "daracceso",
    description: "Permite a un usuario acceder a tu sala de voz de tu sesión pomodoro.",
    timeout: 5000,
    options: [
        {
            name: "usuario",
            description: "Usuario a dar acceso.",
            type: 6,
            required: true
        }
    ],

    run: async (interaction, client) => {
        member = interaction.options.getMember('usuario');

        const pomodoroSession = client.pomodoroContainer.getPomodoroSessionByUser(interaction.user);

        if (!pomodoroSession) {
            return interaction.reply({ content: "No tienes ninguna sesión pomodoro activa.", ephemeral: true });
        }

        pomodoroSession.voiceChannel.permissionOverwrites.edit(member, {
            Connect: true,
            Speak: true
        });

        member.send(`Se te ha dado acceso a la sala de voz de la sesión pomodoro de ${interaction.user.username}.`);
        interaction.reply({ content: `Se le ha dado acceso a ${member.user.username} a la sala de voz de tu sesión pomodoro.`, ephemeral: true });

        setTimeout(() => {
            interaction.deleteReply();
        }, 5000);

    }
}
