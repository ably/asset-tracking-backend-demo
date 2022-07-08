const jwt = require('jsonwebtoken');

const {
  firestore,
  fail,
  USER_TYPE_CUSTOMER,
  USER_TYPE_RIDER,
  STATUS_CODE_BAD_REQUEST,
  STATUS_CODE_CREATED,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_CONFLICT,
  STATUS_CODE_NOT_FOUND,
  STATUS_CODE_OK,
} = require('./common');

class RequestError extends Error {
  constructor(message = 'Invalid request.', ...args) {
    super(message, ...args);
  }
}

const COLLECTION_NAME_ORDERS = 'orders';
const CUSTOMER_CAPABILITIES = ['publish', 'subscribe', 'history', 'presence'];
const RIDER_CAPABILITIES = ['publish', 'subscribe'];
const ABLY_API_KEY_RIDERS = 'ABLY_API_KEY_RIDERS';
const ABLY_API_KEY_CUSTOMERS = 'ABLY_API_KEY_CUSTOMERS';

const getEnvVar = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} not found.`);
  }
  return value;
};

exports.createOrder = async (req, res, next) => {
  const customersApiKey = getEnvVar(ABLY_API_KEY_CUSTOMERS);
  if (res.locals.userType !== USER_TYPE_CUSTOMER) {
    fail(res, STATUS_CODE_UNAUTHORIZED, 'This API is only for Customer use.');
    return;
  }

  const { from, to } = req.body;
  try {
    assertLocation(from);
    assertLocation(to);
  } catch (e) {
    if (e instanceof RequestError) {
      fail(res, STATUS_CODE_BAD_REQUEST, e.message);
      return;
    }
    throw e;
  }

  const { username } = res.locals;
  const singletonDocumentReference = firestore.collection('globals').doc('orders');
  const orderId = await firestore.runTransaction(async (transaction) => {
    // Transaction Step 1: Read
    const snapshot = await transaction.get(singletonDocumentReference);

    // Transaction Step 2: Logic
    const id = snapshot.exists ? snapshot.data().nextId : 1;
    if (!id || id < 1) {
      throw new Error(`Database state invalid reading "nextId" from of ${singletonDocumentReference}`);
    }

    // Transaction Step 3: Make Changes
    transaction.set(singletonDocumentReference, { nextId: id + 1 });
    transaction.create(firestore.collection(COLLECTION_NAME_ORDERS).doc(id.toString()), {
      customerUsername: username,
      from,
      to,
    });

    // Transaction Success
    return id;
  });

  const orderIds = await queryAssignedOrders('customerUsername', username);
  if (!orderIds.includes(orderId)) {
    orderIds.push(orderId);
  }

  let webToken;
  const { GOOGLE_MAPS_API_KEY } = process.env;
  try {
    webToken = createWebToken(
      customersApiKey,
      username,
      orderIds,
      CUSTOMER_CAPABILITIES,
    );
    assertGoogleMapsApiKey(GOOGLE_MAPS_API_KEY);
  } catch (error) {
    next(error); // intentionally a 500 Internal Server Error
    return;
  }

  // Success
  res
    .status(STATUS_CODE_CREATED)
    .send({
      orderId,
      ably: {
        token: webToken,
      },
      googleMaps: {
        apiKey: GOOGLE_MAPS_API_KEY,
      },
    });
};

exports.assignOrder = async (req, res, next) => {
  const ridersApiKey = getEnvVar(ABLY_API_KEY_RIDERS);

  if (res.locals.userType !== USER_TYPE_RIDER) {
    fail(res, STATUS_CODE_UNAUTHORIZED, 'This API is only for Rider use.');
    return;
  }

  const orderId = parseInt(req.params.orderId, 10);
  if (orderId < 0) {
    fail(res, STATUS_CODE_NOT_FOUND, `orderId '${orderId} is not a positive integer.`);
    return;
  }

  const documentReference = firestore.collection(COLLECTION_NAME_ORDERS).doc(orderId.toString());
  const { username } = res.locals;
  const { failureReason, statusCode, data } = await firestore.runTransaction(async (transaction) => {
    // Transaction Step 1: Read
    const snapshot = await transaction.get(documentReference);

    // Transaction Step 2: Logic
    if (!snapshot.exists) {
      return {
        failureReason: `An order with id '${orderId}' does not exist.`,
        statusCode: STATUS_CODE_NOT_FOUND,
      };
    }
    const { riderUsername } = snapshot.data();
    const isAlreadyAssignedToThisUser = (riderUsername === username);
    if (!isAlreadyAssignedToThisUser && riderUsername !== undefined) {
      return {
        failureReason: `The order with id '${orderId}' is already assigned to another rider.`,
        statusCode: STATUS_CODE_CONFLICT,
      };
    }

    // Transaction Step 3: Make Changes
    if (!isAlreadyAssignedToThisUser) {
      transaction.update(documentReference, {
        riderUsername: username,
      });
    }

    // Transaction Success
    return { data: snapshot.data() };
  });

  if (failureReason) {
    fail(res, statusCode, failureReason);
    return;
  }

  const orderIds = await queryAssignedOrders('riderUsername', username);
  if (!orderIds.includes(orderId)) {
    orderIds.push(orderId);
  }

  let webToken;
  const { MAPBOX_ACCESS_TOKEN } = process.env;
  try {
    webToken = createWebToken(
      ridersApiKey,
      username,
      orderIds,
      RIDER_CAPABILITIES,
    );
    assertMapboxAccessToken(MAPBOX_ACCESS_TOKEN);
  } catch (error) {
    next(error); // intentionally a 500 Internal Server Error
    return;
  }

  // Success
  res
    .status(STATUS_CODE_CREATED)
    .send({
      ...data,
      ably: {
        token: webToken,
      },
      mapbox: {
        token: MAPBOX_ACCESS_TOKEN,
      },
    });
};

exports.deleteOrder = async (req, res) => {
  const { userType } = res.locals;
  const userIsRider = (userType === USER_TYPE_RIDER);
  const userIsCustomer = (userType === USER_TYPE_CUSTOMER);
  if (!(userIsRider || userIsCustomer)) {
    fail(res, STATUS_CODE_UNAUTHORIZED, 'This API is only for use by either Rider or Customer.');
    return;
  }

  const orderId = parseInt(req.params.orderId, 10);
  if (orderId < 0) {
    fail(res, STATUS_CODE_NOT_FOUND, `orderId '${orderId} is not a positive integer.`);
    return;
  }

  const documentReference = firestore.collection(COLLECTION_NAME_ORDERS).doc(orderId.toString());
  const { username } = res.locals;
  const { failureReason, statusCode } = await firestore.runTransaction(async (transaction) => {
    // Transaction Step 1: Read
    const snapshot = await transaction.get(documentReference);

    // Transaction Step 2: Logic
    if (!snapshot.exists) {
      return {
        failureReason: `An order with id '${orderId}' does not exist.`,
        statusCode: STATUS_CODE_NOT_FOUND,
      };
    }
    const { riderUsername, customerUsername } = snapshot.data();
    const allowedUsername = userIsRider ? riderUsername : customerUsername;
    if (allowedUsername !== username) {
      return {
        failureReason: `The order with id '${orderId}' is not assigned to this ${userIsRider ? 'Rider' : 'Customer'}.`,
        statusCode: STATUS_CODE_CONFLICT,
      };
    }

    // Transaction Step 3: Make Changes
    transaction.delete(documentReference);

    // Transaction Success
    return { };
  });

  if (failureReason) {
    fail(res, statusCode, failureReason);
    return;
  }

  // Success
  res.sendStatus(STATUS_CODE_OK);
};

exports.getGoogleMaps = async (req, res, next) => {
  const { GOOGLE_MAPS_API_KEY } = process.env;

  try {
    assertGoogleMapsApiKey(GOOGLE_MAPS_API_KEY);
  } catch (error) {
    next(error); // intentionally a 500 Internal Server Error
    return;
  }

  // Success
  res
    .status(STATUS_CODE_OK)
    .send({
      apiKey: GOOGLE_MAPS_API_KEY,
    });
};

exports.getMapbox = async (req, res, next) => {
  const { MAPBOX_ACCESS_TOKEN } = process.env;
  try {
    assertMapboxAccessToken(MAPBOX_ACCESS_TOKEN);
  } catch (error) {
    next(error); // intentionally a 500 Internal Server Error
    return;
  }

  // Success
  res
    .status(STATUS_CODE_OK)
    .send({
      token: MAPBOX_ACCESS_TOKEN,
    });
};

exports.getAbly = async (req, res, next) => {
  let apiKey;
  let fieldName;
  let capabilities;
  switch (res.locals.userType) {
    case USER_TYPE_CUSTOMER:
      apiKey = getEnvVar(ABLY_API_KEY_CUSTOMERS);
      fieldName = 'customerUsername';
      capabilities = CUSTOMER_CAPABILITIES;
      break;

    case USER_TYPE_RIDER:
      apiKey = getEnvVar(ABLY_API_KEY_RIDERS);
      fieldName = 'riderUsername';
      capabilities = RIDER_CAPABILITIES;
      break;

    default:
      fail(res, STATUS_CODE_UNAUTHORIZED);
      return;
  }

  const { username } = res.locals;
  const orderIds = await queryAssignedOrders(fieldName, username);

  let webToken;
  try {
    webToken = createWebToken(
      apiKey,
      username,
      orderIds,
      capabilities,
    );
  } catch (error) {
    next(error); // intentionally a 500 Internal Server Error
    return;
  }

  // Success
  res
    .status(STATUS_CODE_OK)
    .send({
      token: webToken,
    });
};

function assertNumber(value) {
  const type = typeof value;
  if (type !== 'number') {
    throw new RequestError(`Value '${value}', of type '${type}', is not a number.`);
  }
}

function assertLatitude(latitude) {
  assertNumber(latitude);
  if (latitude < -90.0 || latitude > 90.0) {
    throw new RequestError(`Latitude '${latitude}' is out of range.`);
  }
}

function assertLongitude(longitude) {
  assertNumber(longitude);
  if (longitude < -180.0 || longitude > 180.0) {
    throw new RequestError(`Longitude '${longitude}' is out of range.`);
  }
}

function assertLocation(location) {
  const type = typeof location;
  if (type !== 'object' || location === null) {
    throw new RequestError(`Value '${location}', of type '${type}', is not a non-null object.`);
  }
  assertLatitude(location.latitude);
  assertLongitude(location.longitude);
}

function createWebToken(ablyApiKey, clientId, orderIds, capabilities) {
  if (!ablyApiKey) {
    throw new Error('Ably API key not supplied.');
  }
  if (!clientId) {
    throw new Error('Client identifier not supplied.');
  }
  if (!Array.isArray(orderIds)) {
    throw new Error('orderIds must be an array of strings.');
  }
  if (!Array.isArray(capabilities)) {
    throw new Error('capabilities must be an array of strings.');
  }

  const keyParts = ablyApiKey.split(':', 2);
  if (keyParts.length !== 2) {
    throw new Error('Ably API key did not split into exactly two parts.');
  }

  const keyName = keyParts[0];
  const keySecret = keyParts[1];
  const ttlSeconds = 3600;

  const capabilitiesMap = {};
  orderIds.forEach((orderId) => {
    capabilitiesMap[`tracking:${orderId}`] = capabilities;
  });

  const payload = {
    'x-ably-capability': JSON.stringify(capabilitiesMap),
    'x-ably-clientId': clientId,
  };

  const options = {
    expiresIn: ttlSeconds,
    keyid: `${keyName}`,
  };

  return jwt.sign(payload, keySecret, options);
}

function assertGoogleMapsApiKey(value) {
  if (!value) {
    throw new Error('Environment variable for Google Maps API key not found.');
  }
}

function assertMapboxAccessToken(value) {
  if (!value) {
    throw new Error('Environment variable for Mapbox access token not found.');
  }
}

async function queryAssignedOrders(fieldName, username) {
  const querySnapshot = await firestore.collection(COLLECTION_NAME_ORDERS).where(fieldName, '==', username).get();
  if (querySnapshot.empty) {
    return [];
  }

  const orderIds = [];
  querySnapshot.forEach((documentSnapshot) => {
    orderIds.push(documentSnapshot.id);
  });
  return orderIds;
}
