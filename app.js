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

const app = express();
mongoose.connect(process.env.DB_URL, {
  autoIndex: false,
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  poolSize: 100
});
mongoose.connection.on("open", () => {
  console.log("connected to db");
});
mongoose.connection.on("error", (err) => {
  console.log(err.message);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());
app.use(cors());
app.use(compression());

app.use("/api/auth", authController);
app.use("/api", authorizedUser, protectedController);
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(catchError);

module.exports = app;
