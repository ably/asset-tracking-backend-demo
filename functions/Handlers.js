const {
  firestore,
} = require('./common');

const STATUS_CODE_CREATED = 201;
const STATUS_CODE_BAD_REQUEST = 400;

class RequestError extends Error {
  constructor(message = 'Invalid request.', ...args) {
    super(message, ...args);
  }
}

exports.createOrder = async (req, res) => {
  const { from, to } = req.body;
  try {
    assertLocation(from);
    assertLocation(to);
  } catch (e) {
    if (e instanceof RequestError) {
      res
        .status(STATUS_CODE_BAD_REQUEST)
        .send(e.message);
      return;
    }
    throw e;
  }

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
    transaction.create(firestore.collection('orders').doc(id.toString()), {
      username: res.locals.username,
      from,
      to,
    });

    // Transaction Success
    return id;
  });

  res
    .status(STATUS_CODE_CREATED)
    .send({ orderId });
};

function assertNumber(value) {
  const type = typeof value;
  if (type !== 'number') {
    throw new RequestError(`Value "${value}", of type "${type}", is not a number.`);
  }
}

function assertLatitude(latitude) {
  assertNumber(latitude);
  if (latitude < -90.0 || latitude > 90.0) {
    throw new RequestError(`Latitude "${latitude}" is out of range.`);
  }
}

function assertLongitude(longitude) {
  assertNumber(longitude);
  if (longitude < -180.0 || longitude > 180.0) {
    throw new RequestError(`Longitude "${longitude}" is out of range.`);
  }
}

function assertLocation(location) {
  const type = typeof location;
  if (type !== 'object' || location === null) {
    throw new RequestError(`Value "${location}", of type "${type}", is not a non-null object.`);
  }
  assertLatitude(location.latitude);
  assertLongitude(location.longitude);
}
