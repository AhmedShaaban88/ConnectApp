module.exports = function (err, req, res, next) {
  if(err.name === 'MulterError'){
    return res.status(400).json({errors: err.message})
  }
  else if(err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError'){
    return res.status(401).json({errors: err.message})
  }
  return res
    .status(err.status || 500)
    .json(err.message || "Something wrong happen");
};
