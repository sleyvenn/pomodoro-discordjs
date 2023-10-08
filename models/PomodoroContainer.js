const PomodoroSession = require('./PomodoroSession');
const dbConnection = require('../database/connection');
const formatDateToSQL = require('../utils/formatDate');

class PomodoroContainer {

    constructor() {
        this.pomodoroSessions = [];
    }

    static instance;

    static getInstance() {
        if (!this.instance) {
            cancelAllPomodoroSessions();
            this.instance = new PomodoroContainer();
        }

        return this.instance;
    }

    static addPomodoroSession(pomodoroSession) {
        var pomodoroSessions = this.getInstance().pomodoroSessions;

        pomodoroSessions.push(pomodoroSession);
    }

    static removePomodoroSession(pomodoroSession) {
        var pomodoroSessions = this.getInstance().pomodoroSessions;

        for (var i = 0; i < pomodoroSessions.length; i++) {
            if (pomodoroSessions[i].id === pomodoroSession.id) {
                pomodoroSessions.splice(i, 1);
                return;
            }
        }
    }

    static getPomodoroSessionByUser(user) {
        var pomodoroSessions = this.getInstance().pomodoroSessions;

        for (var i = 0; i < pomodoroSessions.length; i++) {
            if (pomodoroSessions[i].user.id === user.id) {
                return pomodoroSessions[i];
            }
        }

        return undefined;
    }

    static getPomodoroSessionById(id) {
        return this.pomodoroSessions.find(pomodoroSession => pomodoroSession.id === id);
    }
}

function cancelAllPomodoroSessions() {
    const connection = new dbConnection();
    connection.query('UPDATE pomodoro_sessions SET status = 3, end_time = ? WHERE status = 0 OR status = 1', [formatDateToSQL(new Date())]).then((result) => {
        console.log("All broken pomodoro sessions cancelled. Total: " + result.affectedRows);
        connection.close();
    }).catch((error) => {
        console.error(error);
    });
}

module.exports = PomodoroContainer