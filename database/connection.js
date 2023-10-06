require('dotenv').config();
const mysql = require('mysql2');

class connection {
    constructor() {
        this.db = mysql.createConnection({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DATABASE
        });
    }

    query(sql, args) {
        return new Promise((resolve, reject) => {
            this.db.query(sql, args, (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.end(err => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
}

module.exports = connection;