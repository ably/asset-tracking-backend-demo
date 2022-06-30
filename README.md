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

## Runtime Requirements

A
[Firebase](https://firebase.google.com/)
account with support for
[Firestore](https://firebase.google.com/products/firestore)
and
[Functions](https://firebase.google.com/products/functions)
(which probably means a paid plan).
