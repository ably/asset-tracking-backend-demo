const express = require('express');
const cors = require('cors');
const basicAuth = require('basic-auth');

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

const {
  firestore,
  fail,
  isUserType,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_INTERNAL_SERVER_ERROR,
  ABLY_API_KEY_CUSTOMERS,
  ABLY_API_KEY_RIDERS,
} = require('./common');

const {
  createOrder,
  assignOrder,
  deleteOrder,
  getGoogleMaps,
  getMapbox,
  getAbly,
} = require('./Handlers');

const { logger } = functions;

const SECRET_NAMES = [
  ABLY_API_KEY_RIDERS,
  ABLY_API_KEY_CUSTOMERS,
  'MAPBOX_ACCESS_TOKEN',
  'GOOGLE_MAPS_API_KEY',
];

const authorizeMiddleware = async (req, res, next) => {
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
  fail(res, STATUS_CODE_UNAUTHORIZED); // intentionally not providing a message as it could assist probing hackers
};

const errorHandlingMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    // per: https://expressjs.com/en/guide/error-handling.html
    // We have to fallback to the default handler if headers have already been sent.
    next(err);
    return;
  }
  fail(res, STATUS_CODE_INTERNAL_SERVER_ERROR, err.message);
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
app.delete('/orders/:orderId', deleteOrder);
app.get('/googleMaps', getGoogleMaps);
app.get('/mapbox', getMapbox);
app.get('/ably', getAbly);

// Our custom error handler, which must be defined here, after other app.use() and routes calls.
app.use(errorHandlingMiddleware);

// Expose Express API as a single Cloud Function.
exports.deliveryService = functions
  .region('europe-west2')
  .runWith({ secrets: SECRET_NAMES })
  .https
  .onRequest(app);
