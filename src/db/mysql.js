import mysql from 'mysql2'


export const connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'junseok12!',
    database : 'CORI'
})


