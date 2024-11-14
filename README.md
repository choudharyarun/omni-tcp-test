# Omni OC32 TCP Communication

This project implements a Node.js server for communicating with Omni OC32 IoT devices over TCP and HTTP. The server handles various commands and responses from the devices and updates Firestore with the relevant data.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Command Types](#command-types)
- [License](#license)

## Installation

1. Clone the repository:

   ```sh
   git clone <repository-url>
   cd omni-tcp
   ```

2. Install the dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file and fill in the required environment variables.

## Usage

1. Start the server:

   ```sh
   node index.js
   ```

2. The server will start on the following ports:
   - TCP server: `8002`
   - Express API: `3001`

## API Endpoints

### Unlock

- **URL:** `/unlock`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "userId": "string"
  }
  ```

### Location

- **URL:** `/location`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Location Tracking

- **URL:** `/location-tracking`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "interval": "number"
  }
  ```

### Status

- **URL:** `/status`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Activate Alarm

- **URL:** `/activate-alarm`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "ringTimes": "number"
  }
  ```

### Firmware Info

- **URL:** `/firmware-info`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Start Upgrade

- **URL:** `/start-upgrade`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "upgradeDataPackage": "string",
    "dataLengthPerPackage": "number",
    "crc16": "string",
    "deviceTypeCode": "string",
    "upgradeKey": "string"
  }
  ```

### BLE Key

- **URL:** `/ble-key`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "action": "number",
    "bleKey": "string"
  }
  ```

### SIM ICCID

- **URL:** `/sim-iccid`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Bluetooth MAC

- **URL:** `/bluetooth-mac`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Power Off

- **URL:** `/power-off`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### Reboot

- **URL:** `/reboot`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string"
  }
  ```

### RFID Unlock

- **URL:** `/rfid-unlock`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "bikeNumber": "string"
  }
  ```

### RFID Management

- **URL:** `/rfid-management`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceId": "string",
    "operation": "string",
    "adminBikedNumber": "string"
  }
  ```

## Command Types

The following command types are supported:

- `Q0`: Check-in
- `H0`: Heartbeat
- `L0`: Unlock
- `L1`: Lock
- `D0`: Location
- `D1`: Location Tracking
- `S5`: Status
- `S8`: Activate Alarm
- `G0`: Firmware Info
- `W0`: Alarm
- `U0`: Upgrade Available
- `U1`: Upgrade Data Request
- `U2`: Upgrade Results Notification
- `K0`: BLE Key
- `I0`: SIM ICCID
- `M0`: Bluetooth MAC
- `S0`: Power Off
- `S1`: Reboot
- `C0`: RFID Unlock
- `C1`: RFID Management

## License

Copyright © 2024 Plum Mobility Ltd. All rights reserved.

This software is proprietary and intended for internal use only. Unauthorized copying, modification, distribution, or use without explicit permission is strictly prohibited.
