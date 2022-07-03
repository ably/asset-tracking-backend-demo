const express = require('express');
const cors = require('cors');
const basicAuth = require('basic-auth');

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

const {
  firestore,
  isUserType,
  STATUS_CODE_UNAUTHORIZED,
} = require('./common');

const {
  createOrder,
  assignOrder,
} = require('./Handlers');

const { logger } = functions;

const authorizeMiddleware = async (req, res, next) => {
  const credentials = basicAuth(req);
  if (!credentials) {
    logger.info('Invalid Authorization header, or header missing.');
    res.sendStatus(STATUS_CODE_UNAUTHORIZED);
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
    // explains why we need to do this error propogation 'by hand'.
    next(error);
    return;
  }

  if (!data) {
    logger.info(`User '${name}' not found.`);
  } else if (data.password === pass) {
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

  logger.info(`Incorrect password supplied for user '${name}'. Received '${pass}', expected '${data.password}'.`);
  res.sendStatus(STATUS_CODE_UNAUTHORIZED);
};

const app = express();

// Automatically allow cross-origin requests.
app.use(cors({ origin: true }));

// Add middleware to check credentials supplied via HTTP Basic auth.
app.use(authorizeMiddleware);

// TODO Understand why we _don't_ appear to need `app.use(express.json());`. This works without it.

// Our Express API.
app.get('/', (req, res) => res.send({ })); // returns empty object, as JSON, by way of auth confirmation

app.post('/orders/', createOrder);
app.put('/orders/:orderId', assignOrder);

// Expose Express API as a single Cloud Function.
exports.deliveryService = functions
  .region('europe-west2')
  .https
  .onRequest(app);
