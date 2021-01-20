require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const helmet = require("helmet");
const cors = require('cors');
const compression = require("compression");
const mongoose = require("mongoose");
const catchError = require("./middleware/catchError");
const authController = require("./routes/authController");
const protectedController = require("./routes/protectedController");
const authorizedUser = require("./middleware/authorizedUser");
const rateLimit = require("express-rate-limit");

const app = express();
mongoose.connect(process.env.DB_URL, {
  autoIndex: false,
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  poolSize: 100
}).catch(err => catchError({status: 500, message: 'Database connection failed'}));

mongoose.connection.on("error", (err) => {
  mongoose.disconnect();
  mongoose.connection.close();
  catchError({status: 500, message: 'Database connection failed'});
});
mongoose.connection.on("disconnected", (reason) => {
  catchError({status: 500, message: 'Database connection stopped'});
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());
app.use(cors());
app.use(compression());
app.set('trust proxy', 1);
const apiLoginLimiter = rateLimit({
  windowMs: 20 * 60 * 1000,
  max: 50,
});
app.use("/api/auth", apiLoginLimiter, authController);
app.use("/api", authorizedUser, protectedController);
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(catchError);

module.exports = app;
