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

        
    }
}
