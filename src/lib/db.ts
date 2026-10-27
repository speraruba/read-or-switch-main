import mysql from 'mysql2/promise';

export const pool = process.env.MYSQL_URL
    ? mysql.createPool(process.env.MYSQL_URL)
    : mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
      });

export async function query(sql: string, values?: (string | number | boolean | null)[]) {
    const [results] = await pool.execute(sql, values);
    return results;
}
