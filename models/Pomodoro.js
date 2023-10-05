class Pomodoro {
    
    constructor(client, user, channel) {
        this.client = client;
        this.user = user;
        this.channel = channel;
    }

    CreateSession() {
        this.channel.send(`Hola ${this.user.displayName}!`)
    }
}