# Ably Asset Tracking Backend Demo

_[Ably](https://ably.com) is the platform that powers synchronized digital experiences in realtime. Whether attending an event in a virtual venue, receiving realtime financial information, or monitoring live car performance data – consumers simply expect realtime digital experiences as standard. Ably provides a suite of APIs to build, extend, and deliver powerful digital experiences in realtime for more than 250 million devices across 80 countries each month. Organizations like Bloomberg, HubSpot, Verizon, and Hopin depend on Ably’s platform to offload the growing complexity of business-critical realtime data synchronization at global scale. For more information, see the [Ably documentation](https://ably.com/documentation)._

## Overview

This demo presents a mock backend service with functionality matching that expected for the typical use case for
[Ably's Asset Tracking solution](https://ably.com/solutions/asset-tracking),
being the tracking of deliveries to customers.
Those deliveries could be food, groceries or other packages ordered for home delivery.

### Related Demos

This demo backend service has been designed to interoperate with the following demo apps:

- **Rider**: Used by delivery riders / drivers. The publisher.
  - [Android](https://github.com/ably/asset-tracking-android-rider-app-demo)
  - [iOS](https://github.com/ably/asset-tracking-ios-rider-app-demo)
- **Subscriber**: Used by customers / consumers, to track their delivery.
  - [Android](https://github.com/ably/asset-tracking-android-customer-app-demo)
  - [iOS](https://github.com/ably/asset-tracking-ios-customer-app-demo)
  - Web (repository link TBC)

### Delivery Lifecycle

In the simplest scenario, where a Rider is only carrying a single Customer order at any given time:

1. Customer places order for Delivery and starts observing this Delivery, though they will not see any Location updates yet
2. Rider requests, or is assigned, the Delivery
3. Rider travels to the Merchant
4. Merchant gives the Delivery to the Rider
5. Rider starts transmitting Location updates for this Delivery, meaning that the Customer starts seeing Location updates now
6. Rider travels from Merchant to Customer with the Delivery
7. Rider gives the Delivery to the Customer
8. Rider stops transmitting Location updates for this Delivery
9. Customer stops tracking Location updates

A real delivery backend service will have states for the Delivery order including stages like "placed", "accepted by Merchant" and "being prepared".
This demo backend service does not emulate those stages, to keep things simpler, instead focussing on the core Delivery Location tracking element.

In respect of the state of the Rider, in the context of a particular Delivery, from the perspective of the Customer, referencing the steps from the simplest scenario outlined above:

| Rider State | Emulated by this demo backend service? |
| ----------- | -------------------------------------- |
| accepted the Delivery | Yes, step 2 |
| waiting at the Merchant | No |
| has picked up your Delivery | No |
| is on the way | Yes, step 5 |
| is nearby | No |
| is here | Yes, step 8 |

The Customer expects to see a map showing:

- The destination
- The Merchant
- The Rider

## Runtime Requirements

A
[Firebase](https://firebase.google.com/)
account with support for
[Firestore](https://firebase.google.com/products/firestore)
and
[Functions](https://firebase.google.com/products/functions)
(which probably means a paid plan).

## Deployment

From root, the following command builds the functions and pushes them out to Firebase:

    firebase deploy --only functions

as described in:
[Firebase: Get started: Deploy functions to a production environment](https://firebase.google.com/docs/functions/get-started#deploy-functions-to-a-production-environment)

## Development and Testing

In common with most Firebase projects,
[the contents of the `functions` folder](functions/)
is a [Node.js](https://nodejs.org/) application using [npm](https://www.npmjs.com/) for dependency management.
This means that the `npm` commands should be utilised within that folder,
while `firebase` commands are generally used from root.

### Testing with the Local Emulator

From root, the following command builds the functions and serves them locally:

    firebase emulators:start

as described in
[Firebase: Get started: Emulate execution of your functions](https://firebase.google.com/docs/functions/get-started#emulate-execution-of-your-functions)

If it emits the following `functions` warning to the console:

```
i  emulators: Starting emulators: functions
⚠  functions: The following emulators are not running, calls to these services from the Functions emulator will affect production: auth, firestore, database, hosting, pubsub, storage
```

Indicating that HTTP requests made against this functions emulator instance will use the live Firestore database.
This is probably fine, perhaps preferable for some testing, but is worth noting as caution should be exercised.

It also emits information to the console, which will look something like:

```
┌───────────┬────────────────┬─────────────────────────────────┐
│ Emulator  │ Host:Port      │ View in Emulator UI             │
├───────────┼────────────────┼─────────────────────────────────┤
│ Functions │ localhost:5001 │ http://localhost:4000/functions │
└───────────┴────────────────┴─────────────────────────────────┘
```

where you can visit port `4000` from your browser for access to function runtime logs, amongst much more.
The functions themselves are hosted at port `5001`, so can be tested there, for example:

    curl --verbose \
      --user "username:password" \
      http://localhost:5001/<firebase-project-name>/<firebase-region>/deliveryService
      

It's also worth noting that the emulator supports automatic reloading, so the effect of changes you make to the source code files while the emulator is running will immediately be available to observe.
This can make for a very productive debugging experience.

## REST API

The content type for requests and responses is `application/json`, with root of [JSON](https://www.json.org/) `object` type.

### Create Order

`POST /orders`

Used by the Customer app to kick off a new Delivery requirement.
Creates a new order with a unique order identifier.

Request properties:

- `from`: [Location](#location-type) of the Merchant.
- `to`: [Location](#location-type) of the Customer.

Response properties:

- `orderId`: The unique order identifier for this new Delivery. A positive integer.
- `ablyToken`: The JSON Web Token (JWT) to be used to subscribe for Location updates for this new Delivery.

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders \
  --user "username:password" \
  --header "Content-Type: application/json" \
  --request POST \
  --data '{"from":{"latitude":1,"longitude":2},"to":{"latitude":3,"longitude":4}}'
```

Example response:

```json
{
  "orderId": 3,
  "ablyToken": "<SECRET_REDACTED>"
}
```

### Assign Order

`PUT /orders/<orderId>`

Used by the Rider app to self-assign a Delivery requirement.
Modifies an unassigned order to assign it to this rider.

Response properties:

- `customerUsername`: The username of the Customer who created this Delivery requirement.
- `from`: [Location](#location-type) of the Merchant.
- `to`: [Location](#location-type) of the Customer.
- `ablyToken`: The JSON Web Token (JWT) to be used to publish Location updates for this Delivery.

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders/<orderId> \
  --user "username:password" \
  --request PUT
```

Example response:

```json
{
  "to": {
    "longitude": 4,
    "latitude": 3
  },
  "customerUsername": "quintin",
  "from": {
    "longitude":2,
    "latitude":1
  },
  "ablyToken": "<SECRET_REDACTED>"
}
```

This endpoint can safely be called multiple times and, as such, can be considered idempotent.
The response includes only fields were present in the database before the request was made, which means that subsequent
calls to this endpoint by the same rider for the same order will observe an additional field in the response by the name
of `riderUsername` - this is expected behaviour, being a side effect of the simplistic implementation of this demo
backend service.

## REST API Types

### Location Type

| Field | Type | Description |
| ----- | ---- | ----------- |
| `latitude` | number | **Required** - Must be a value between `-90.0` and `90.0`. |
| `longitude` | number | **Required** - Must be a value between `-180.0` and `180.0`. |
