const basicAuth = require('basic-auth');
const crypto = require('crypto');
const functions = require('firebase-functions');
const {
  fail,
  STATUS_CODE_UNAUTHORIZED,
  firestore,
  isUserType,
} = require('./common');

const { logger } = functions;

module.exports.authorizeMiddleware = async (req, res, next) => {
  const credentials = basicAuth(req);
  if (!credentials) {
    logger.info('Invalid Authorization header, or header missing.');
    fail(res, STATUS_CODE_UNAUTHORIZED); // intentionally not providing a message as it could assist probing hackers
    return;
  }

  const { name, pass } = credentials;

  let data;
  try {
    const snapshot = await firestore.collection('users').doc(name).get();
    data = snapshot.data();
  } catch (error) {
    // Ask Express to respond with HTTP 500 Internal Server Error.
    // see: https://expressjs.com/en/guide/error-handling.html
    // It's worth noting that, by default, Express serves this as HTML and includes all Error detail.
    // It's also worth noting that this code was written against Express 4, given Express 5 was still in Beta - which
    // explains why we need to do this error propagation 'by hand'.
    next(error);
    return;
  }

  if (!data) {
    logger.info(`User '${name}' not found.`);
  } else if (comparePassword(pass, data.password, data.salt)) {
    const userType = data.type;
    if (!isUserType(userType)) {
      next(new Error(`User type '${userType}', as specified for user '${name}', is unknown.`));
      return;
    }

    // make available for other middleware, specifically API handlers
    res.locals.username = name;
    res.locals.userType = userType;

    next(); // Success
    return;
  }

  logger.info(`Incorrect password supplied for user '${name}'.`);
  fail(res, STATUS_CODE_UNAUTHORIZED); // intentionally not providing a message as it could assist probing hackers
};

// Compares the input password and salt to the stored SHA256 hash in the user data
const comparePassword = (input, hashedPassword, salt) => {
  const hashedInput = crypto.createHash('sha256').update(salt + input).digest('hex');
  return hashedInput === hashedPassword;
};
