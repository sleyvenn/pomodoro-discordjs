const connection = require("../../database/connection")

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

    run: async (interaction) => {
        const member = interaction.options.getMember('usuario')

        await connection.executeSQLTransaction(`SELECT * FROM pomodoro_sessions WHERE user_id = '${interaction.user.id}' AND (status = 0 OR status = 1)`,).then(rows => {
            console.log("estoy buscando sesiones")
            if (rows.length > 0) {
                console.log("hay sesiones")
                const channel = interaction.guild.channels.cache.get(rows[0].voice_channel_id)

                channel.permissionOverwrites.edit(member, {
                    Connect: true,
                    Speak: true,
                }).then(() => {
                    interaction.reply({ content: `Se le ha dado permiso a ${member} para acceder a tu sala de voz.`, ephemeral: true })
                    member.send({ content: `Se te ha permitido acceder a la sala de voz de ${interaction.user.username} para su sesión Pomodoro. Recuerda que una vez finalice la sesión el canal de voz se borrará.` })
                }
                ).catch(console.error)
            }

            setTimeout(() => {
                interaction.deleteReply()
            }, 5000)
        }
        ).catch(console.error)
    }
}
