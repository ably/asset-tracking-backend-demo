# Ably Asset Tracking Backend Demo

[![.github/workflows/check.yml](https://github.com/ably/asset-tracking-backend-demo/actions/workflows/check.yml/badge.svg)](https://github.com/ably/asset-tracking-backend-demo/actions/workflows/check.yml)

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
  - [Web](https://github.com/ably/asset-tracking-web-customer-app-demo)

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

### Environment Variable and Secret Names

To make this codebase more navigable alongisde associated service configurations,
we've conformed naming of secrets in the three locations you'll find them, that is:

1. As secrets [configured via the Firebase CLI](https://firebase.google.com/docs/functions/config-env#create-secret)
2. As environment variables fed into the Node.js process at runtime
3. In the source code, populated from `process.env`
  (also defined as static strings as members of the `SECRET_NAMES` array defined in [`index.js`](functions/index.js))

| Secret Name | Description |
| ----------- | ----------- |
| `ABLY_API_KEY_RIDERS` | Used to sign JSON web tokens returned to `rider` users by this service. |
| `ABLY_API_KEY_CUSTOMERS` | Used to sign JSON web tokens returned to `customer` users by this service. |
| `MAPBOX_ACCESS_TOKEN` | Returned to Rider apps in [Assign Order](#assign-order) responses. |
| `GOOGLE_MAPS_API_KEY` | Returned to Customer apps in [Create Order](#create-order) responses. |

### Ably API Key Capabilities

`ABLY_API_KEY_RIDERS` must have been created with the following capabilities:

- **Publish** - publish messages to channels
- **Subscribe** - subscribe to receive messages and presence state changes on channels

`ABLY_API_KEY_CUSTOMERS` must have been created with the following capabilities:

- **Publish** - publish messages to channels
- **Subscribe** - subscribe to receive messages and presence state changes on channels
- **History** - retrieve message and presence state history on channels
- **Presence** - register presence on a channel (enter, update and leave)

It is recommended, for best practice in respect of security architecture, to:

- restrict each key to just the set of capabilities detailed above for it
- resource restrict each key to only be able to access channels (not queues)
- consider enabling [revocable tokens](https://ably.com/docs/core-features/authentication#token-revocation)

See [Ably Token](#ably-token) for details of the capabilities given to tokens signed by this service with these keys.

## Deployment

The following command builds the functions and pushes them out to Firebase:

    firebase deploy --only functions

as described in:
[Firebase: Get started: Deploy functions to a production environment](https://firebase.google.com/docs/functions/get-started#deploy-functions-to-a-production-environment)

## Development and Testing

In common with most Firebase projects,
[the contents of the `functions` folder](functions/)
is a [Node.js](https://nodejs.org/) application using [npm](https://www.npmjs.com/) for dependency management.
This means that the `npm` commands should be utilised within that folder,
while `firebase` commands are generally used from root (though they do work from here too).

### Creating Users

All endpoints presented by this demo backend service require [HTTP Basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#basic_authentication_scheme).

Credentials - `user-id` (username) and `user-pass` (password) - are validated from records in the Firestore database.
There must be a document per user in the the root `users` collection, which can be navigated to in the Firebase Console view of the Firebase project's Cloud Firestore.
The `users` collection in the Console can be found at:

    https://console.firebase.google.com/project/<firebase-project-name>/firestore/data/~2Fusers

Or if you've got a new Firebase project, for which the Firestore database exists but you've not yet created the `users` root collection, then visit here to do that:

    https://console.firebase.google.com/project/<firebase-project-name>/firestore/data/~2F

For each user document in the `users` collection:

- The Document ID is the `user-id` (username)
- The document contents must consist of at least the following fields, both with type of `string`:
  | Field Name | Field Value |
  | ---------- | ----------- |
  | `password` | The `user-pass` (password), in plain text (for simplicity). |
  | `type` | Either '`rider`' or '`customer`'. |

For example, here's the Firebase Console view of the document for a user with `user-id` '`username`' and `user-pass` '`password`':

![Firestore User Document Example](/resources/images/firestore-user.png)

### Testing with the Local Emulator

The following command builds the functions and serves them locally:

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

Successful response status code: `201` Created

Response properties:

- `orderId`: The unique order identifier for this new Delivery. A positive integer.
- `ably.token`: The JSON Web Token (JWT) to be used to subscribe for Location updates for this new Delivery.
- `googleMaps.apiKey`: The API key to be used if rendering maps using Google's engine.

The `googleMaps.apiKey` is static so apps do **not** need to handle the scenario that it changes from request to request.
This means that values received from subsequent calls may be safely ignored, with the app's UI continuing to use
visual components created using the key received from their first call to this endpoint or the
[Get Google Maps](#get-google-maps) endpoint.
This key is likely needed for Android apps and will likely be ignored by iOS apps, in preference for using Apple maps.

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders \
  --user "username:password" \
  --header "Content-Type: application/json" \
  --request POST \
  --data '{"from":{"latitude":1,"longitude":2},"to":{"latitude":3,"longitude":4}}'
```

Example response (prettified):

```json
{
  "orderId": 3,
  "ably": {
    "token": "<SECRET_REDACTED>",
  },
  "googleMaps": {
    "apiKey": "<SECRET_REDACTED>",
  },
}
```

See also: [Ably Token](#ably-token)

### Assign Order

`PUT /orders/<orderId>`

Used by the Rider app to self-assign a Delivery requirement.
Modifies an unassigned order to assign it to this rider.

Successful response status code: `201` Created

Response properties:

- `customerUsername`: The username of the Customer who created this Delivery requirement.
- `from`: [Location](#location-type) of the Merchant.
- `to`: [Location](#location-type) of the Customer.
- `ably.token`: The JSON Web Token (JWT) to be used to publish Location updates for this Delivery.
- `mapbox.token`: The access token to be used for the Mapbox Navigation enhanced location engine.

The `mapbox.token` is static so apps do **not** need to handle the scenario that it changes from request to request.
This means that an Ably Asset Tracking SDK publisher instance may be created using the token received from the
first call to this endpoint or the [Get Mapbox](#get-mapbox) endpoint, with the token value received from subsequent
calls to this endpoint safely ignored.

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders/<orderId> \
  --user "username:password" \
  --request PUT
```

Example response (prettified):

```json
{
  "to": {
    "longitude": 4,
    "latitude": 3
  },
  "customerUsername": "<SECRET_REDACTED>",
  "from": {
    "longitude":2,
    "latitude":1
  },
  "ably": {
    "token": "<SECRET_REDACTED>",
  },
  "mapbox": {
    "token": "<SECRET_REDACTED>",
  },
}
```

This endpoint can safely be called multiple times and, as such, can be considered idempotent.
The response includes only fields were present in the database before the request was made, which means that subsequent
calls to this endpoint by the same rider for the same order will observe an additional field in the response by the name
of `riderUsername` - this is expected behaviour, being a side effect of the simplistic implementation of this demo
backend service.

See also: [Ably Token](#ably-token)

### Delete Order

`DELETE /orders/<orderId>`

Used by either the Rider app or the Customer app to remove, or otherwise declare finished, a Delivery requirement.
Deletes an assigned order from the database.

Successful response status code: `200` OK

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders/<orderId> \
  --user "username:password" \
  --request DELETE
```

### Get Google Maps

`GET /googleMaps`

May be used by the Customer app to obtain the API key for use with Google Maps, typically in advance of calls to any
other endpoint.

Successful response status code: `200` OK

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/googleMaps \
  --user "username:password"
```

Example response (prettified):

```json
{
  "apiKey": "<SECRET_REDACTED>"
}
```

This same, static key is also returned in responses from the [Create Order](#create-order) endpoint.

### Get Mapbox

`GET /mapbox`

May be used by the Rider app to obtain the access token for use with Mapbox, typically in advance of calls to any
other endpoint.

Successful response status code: `200` OK

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/mapbox \
  --user "username:password"
```

Example response (prettified):

```json
{
  "token": "<SECRET_REDACTED>"
}
```

This same, static key is also returned in responses from the [Assign Order](#assign-order) endpoint.

### Get Ably

Used by both the Rider app and the Customer app to request a new authentication token for use with the Ably service.

Apps will need to call this endpoint in response to a token request callback from the Ably SDK.
This will be in one of the following scenarios, relating to the auth token currently in use:

- It has expired
- It has insufficient capabilities:
  Lack of permission to subscribe or publish, as applicable, to the channel for Location updates for a Delivery.

Successful response status code: `200` OK

Example request:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/ably \
  --user "username:password"
```

Example response (prettified):

```json
{
  "token": "<SECRET_REDACTED>"
}
```

See also: [Ably Token](#ably-token)

## REST API Error Responses

Service errors, in common with success responses, are returned with content type `application/json`,
with root of [JSON](https://www.json.org/) `object` type. This object has a single property named `error`, whose value
is another object, representing the `Error`. The `Error` object will usually have a single property named `message`,
whose value is in a human readable form and is designed to be safe to display to the app user. The `message` property
is intentionally not included for auth-related errors (i.e. `401` Unauthorized).

Example request, designed to fail:

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/orders/999999999999 \
  --user "username:password" \
  --request DELETE
```

Example response (prettified):

```json
{
  "error": {
    "message": "An order with id '999999999999' does not exist."
  }
}
```

## REST API Types

### Location Type

| Field | Type | Description |
| ----- | ---- | ----------- |
| `latitude` | number | **Required** - Must be a value between `-90.0` and `90.0`. |
| `longitude` | number | **Required** - Must be a value between `-180.0` and `180.0`. |

## HTTP Request Headers

These are:

- accepted by all endpoints
- here, primarily, to help us QA test the [related demo apps](#related-demos) against this demo backend service

### Ably Token TTL Request Header

Overrides the default time-to-live for returned tokens.

- **Name**: `ably-token-ttl`
- **Value**: Time to live, in seconds, which may not exceed the maximum (see [Ably Token](#ably-token))

Example request, specifying a TTL of 1 minute (60 seconds):

```bash
curl --verbose \
  https://<firebase-region>-<firebase-project-name>.cloudfunctions.net/deliveryService/ably \
  --user "username:password" \
  --header "ably-token-ttl: 60"
```

## Ably Token

Issued with:

- By default, a TTL (time-to-live) of 1 hour (3,600 seconds), which is the maximum duration supported by this service
- [capability](https://ably.com/docs/core-features/authentication#capability-operations):
  - granted for just the Ably [channels](https://ably.com/docs/realtime/channels) for orders which the authenticated user calling the endpoint needs to interact - where those channel names have the `tracking:` [channel namespace](https://ably.com/docs/realtime/channels#channel-namespaces) followed by the order identifier
  - depending on the type of the authenticated user calling the endpoint which returned the token:
    - **Rider**: `subscribe` and `publish`
    - **Customer**: `subscribe`, `publish`, `history` and `presence`
- client identifier (`x-ably-clientId`) set to the `user-id` (username) of the authenticated user calling the endpoint which returned the token

See [Ably API Key Capabilities](#ably-api-key-capabilities), for signing key requirements.

See [Ably Token TTL Request Header](#ably-token-ttl-request-header), for details of the HTTP header which clients may send alongside their requests to override the default TTL.
This is useful for testing purposes.
