module.exports = {
    name: "ping",
    description: "Comprueba la latencia del bot.",
    timeout: 5000,
    run: async (interaction, client) => {
        interaction.reply({ content: "Pong!", ephemeral: true });
    }
}