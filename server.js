import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes/routes.js';
import pool from './db/config.js';
import requestIp from 'request-ip';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import winston from 'winston';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

const app = express();

app.enable('trust proxy');

// Connecting to the database
const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    if (conn) logger.info('MariaDB Connected!');
    conn.release(); // release to pool
  } catch (err) {
    logger.error('Database connection error:', err);
  }
};

connectDB();

app.enable('trust proxy');

// CORS middleware setup to allow requests from specified origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_DOMAIN);
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.use(requestIp.mw());

// Express middleware for parsing requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb' }));
app.use(express.json());
app.use(cors());

app.use(requestIp.mw());
// Serve the static files from the React app
app.use(express.static(path.join(__dirname, '../build')));

// API routes

// Serve static files from the public/uploads directory
app.use('/', express.static('public/works'));
app.use('/', express.static('public'));

app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000; // Providing a default port if none specified

// Starting the server
app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
