require('dotenv').config();
const mysql = require('mysql2');
const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

const connection = mysql.createConnection({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    port: process.env.SQL_PORT
})

async function executeSQLTransaction(sql) {
    return new Promise((resolve, reject) => {
        connection.beginTransaction(err => {
            if (err) {
                reject(err)
            }
            connection.query(sql, (err, results, fields) => {
                if (err) {
                    connection.rollback(() => {
                        reject(err)
                    })
                }
                connection.commit(err => {
                    if (err) {
                        connection.rollback(() => {
                            reject(err)
                        })
                    }
                    resolve(results)
                })
            })
        })
    })
}

async function getSQLData(sql) {
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, results, fields) => {
            if (err) {
                reject(err)
            }
            resolve(results)
        })
    })
}

module.exports = {
    executeSQLTransaction,
    getSQLData
}