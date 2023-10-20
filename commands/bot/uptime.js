const timerConverter = require("../../utils/timerConverter");

module.exports = {
    name: "uptime",
    description: "Muestra el tiempo que el bot lleva encendido.",
    timeout: 5000,
    run: async (interaction, client) => {
        interaction.reply({ content: "El bot lleva encendido " + timerConverter.totalTime(client.uptime), ephemeral: true });
    }
}