// Importing modules using ES6/ES7 syntax
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes/routes.js';
import pool from './db/config.js'; // Make sure your routes file exports the routes using ES6 export syntax
import requestIp from 'request-ip';

dotenv.config();

// Connecting to the database
const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    if (conn) console.log('MariaDB Connected!');
    conn.release(); // release to pool
  } catch (err) {
    console.error(err);
  }
};

connectDB();

const app = express();

// CORS middleware setup to allow requests from specified origins
app.use((req, res, next) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://bpikd-test.contextus.at'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.use(requestIp.mw());

// Express middleware for parsing requests
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb' }));
app.use(express.json());
app.use(cors());

// Using routes
app.use('/', routes);

const PORT = process.env.PORT || 3000; // Providing a default port if none specified

// Starting the server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
