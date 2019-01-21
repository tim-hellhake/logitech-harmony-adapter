# logitech-harmony-adapter

> Adapter may not be working as expected due to a Logitech security fix: https://www.home-assistant.io/blog/2018/12/17/logitech-harmony-removes-local-api/

Logitech Harmony Hub adapter for the [Mozilla IoT gateway](https://iot.mozilla.org).

Bridges the Harmony hub to the gateway so it can start activities and interact with
IR devices connected to the hub.

## Usage
Normally you will just want to install this from the add-ons list provided by
the gateway.

## Building
Build the package using `build.sh`. Afterward go into the tgz and remove `bulb.js` from the `SHA256SUMS` file.
