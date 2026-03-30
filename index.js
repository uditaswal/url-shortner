import express from 'express';
import dotenv from 'dotenv';
import connectDB from './dbConnection.js'
import router from './routes/url.routes.js';
import staticRouter from './routes/static.routes.js';
import userRouter from './routes/user.routes.js';
import { logResAndRes } from './middleware/url.middleware.js'
import path from 'path'
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { restrictToLogginUserOnly } from './middleware/auth.middleware.js';

// current directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

// dot env
dotenv.config({ path: '.env' });

// express setup
const app = express();
const PORT = process.env.PORT || 8000;

// server side rendering via ejs
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser());
app.use(logResAndRes("log.txt"));



app.use('/', staticRouter);
app.use('/api', restrictToLogginUserOnly, router);
app.use('/user', userRouter)


// mongodb Connection
const dbURL = process.env.dbURL;
const dbAppName = process.env.dbAppName;
connectDB(dbURL, dbAppName);

app.listen(PORT, () => console.log(`Server is listening on http://localhost:${PORT}/ at ${new Date().toString()} `));
