// index.js for Node.js server
const net = require("net");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const CommandType = {
  CHECK_IN: "Q0",
  HEARTBEAT: "H0",
  UNLOCK: "L0",
  LOCK: "L1",
  REQUEST_POSITIONING: "D0",
  LOCATION_TRACKING: "D1",
  ACCESS_LOCK_INFO: "S5",
  BIKE_SEARCH: "S8",
  REQUEST_FIRMWARE_INFO: "G0",
  ACTIVATE_ALARM: "W0",
  START_UPGRADE: "U0",
  REQUEST_UPGRADE_DATA: "U1",
  UPGRADE_RESULTS_NOTIFICATION: "U2",
  SET_GET_BLE_KEY: "K0",
  OBTAIN_SIM_ICCID: "I0",
  GET_BLUETOOTH_MAC: "M0",
  SHUTDOWN: "S0",
  REBOOT: "S1",
  EXTERNAL_DEVICE_CONTROL: "L5",
  GET_CABLE_LOCK_FIRMWARE_VERSION: "G1",
  BEACON_VALIDATION: "B0",
  RFID_CARD_UNLOCK_REQUEST: "C0",
  MANAGEMENT_RFID_NUMBER_SETTING: "C1",
  WIFI_POSITIONING: "D2",
};

const PORT = 8002;
const API_PORT = 3001; // Port for the Express API

const deviceSockets = new Map(); // Map to store device ID and socket connections
const unlockPromises = new Map(); // Map to store promises for unlock commands

// Create a TCP server
const server = net.createServer((socket) => {
  console.log("New connection established.");

  socket.on("data", (data) => {
    const command = data.toString().trim();
    console.log("Received data:", command);

    if (command.startsWith("*CMDR")) {
      const parts = command.split(",");
      const deviceId = parts[2];

      // Store the socket connection using the device ID
      deviceSockets.set(deviceId, socket);

      handleIncomingData(command, socket);
    }
  });

  socket.on("end", () => {
    console.log("Connection ended.");
    // Remove the socket from the map when the connection ends
    for (const [deviceId, sock] of deviceSockets.entries()) {
      if (sock === socket) {
        deviceSockets.delete(deviceId);
        break;
      }
    }
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

// Function to handle commands from the IoT device
function handleIncomingData(command, socket) {
  const parts = command.split(",");
  const action = parts[4];
  let response;

  switch (action) {
    case CommandType.CHECK_IN:
      handleCheckInResponse(parts);
      break;
    case CommandType.HEARTBEAT:
      response = handleHeartbeatResponse(parts);
      break;
    case CommandType.UNLOCK:
      response = handleUnlockResponse(parts);
      break;
    case CommandType.LOCK:
      response = handleLockResponse(parts);
      break;
    case CommandType.REQUEST_POSITIONING:
      response = handleRequestPositioningResponse(parts);
      break;
    case CommandType.LOCATION_TRACKING:
      response = handleLocationTrackingResponse(parts);
      break;
    case CommandType.ACCESS_LOCK_INFO:
      response = handleAccessLockInfoResponse(parts);
      break;
    case CommandType.BIKE_SEARCH:
      response = handleBikeSearchResponse(parts);
      break;
    case CommandType.REQUEST_FIRMWARE_INFO:
      response = handleRequestFirmwareInfoResponse(parts);
      break;
    case CommandType.ACTIVATE_ALARM:
      response = handleActivateAlarmResponse(parts);
      break;
    case CommandType.START_UPGRADE:
      response = handleStartUpgradeResponse(parts);
      break;
    case CommandType.REQUEST_UPGRADE_DATA:
      response = handleRequestUpgradeDataResponse(parts);
      break;
    case CommandType.UPGRADE_RESULTS_NOTIFICATION:
      response = handleUpgradeResultsNotification(parts);
      break;
    case CommandType.SET_GET_BLE_KEY:
      response = handleSetGetBLEKeyResponse(parts);
      break;
    case CommandType.OBTAIN_SIM_ICCID:
      response = handleObtainSIMICCIDResponse(parts);
      break;
    case CommandType.GET_BLUETOOTH_MAC:
      response = handleGetBluetoothMACResponse(parts);
      break;
    case CommandType.SHUTDOWN:
      response = handleShutdownResponse(parts);
      break;
    case CommandType.REBOOT:
      response = handleRebootResponse(parts);
      break;
    case CommandType.EXTERNAL_DEVICE_CONTROL:
      response = handleExternalDeviceControlResponse(parts);
      break;
    case CommandType.GET_CABLE_LOCK_FIRMWARE_VERSION:
      response = handleGetCableLockFirmwareVersionResponse(parts);
      break;
    case CommandType.BEACON_VALIDATION:
      response = handleBeaconValidationResponse(parts);
      break;
    case CommandType.RFID_CARD_UNLOCK_REQUEST:
      response = handleRFIDCardUnlockRequest(parts);
      break;
    case CommandType.MANAGEMENT_RFID_NUMBER_SETTING:
      response = handleManagementRFIDNumberSetting(parts);
      break;
    case CommandType.WIFI_POSITIONING:
      response = handleWIFIPositioningResponse(parts);
      break;
    default:
      console.log("Unknown action:", action);
  }

  if (response) {
    console.log(`Sending response: ${response}`);
    socket.write(response);
  }
}

function createCommand(deviceId, commandType, commandContent) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, "")
    .slice(0, 14); // Format: yyMMddHHmmss
  const startBit = "0xFFFF"; // Fixed start bit
  const header = "*CMDS"; // Fixed header
  const manufacturerCode = "OM"; // Fixed manufacturer code
  const endMarker = "#"; // Fixed end marker
  const newLine = "\n"; // New line character

  // Construct the command string
  const command = `${startBit}${header},${manufacturerCode},${deviceId},${timestamp},${commandType},${commandContent}${endMarker}${newLine}`;

  return command;
}

// Function to send commands to the IoT lock
function sendCommand(command, socket) {
  console.log(`Sending command to IoT lock: ${command}`);
  socket.write(command);
}

// Example command handlers
function handleCheckInResponse(parts) {
  // Extract the voltage from the command content
  const voltageStr = parts[5].split("#")[0];
  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Log the voltage
  console.log(`Check-in command received. Battery voltage: ${voltage}%`);

  // No response should be sent back to the IoT lock for the Q0 command
}

function handleHeartbeatResponse(parts) {
  // Extract the lock/unlock status, voltage, and network signal strength from the command content
  const lockStatus = parts[5];
  const voltageStr = parts[6];
  const signalStrength = parts[7].split("#")[0];

  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Log the lock/unlock status, battery voltage, and network signal strength
  console.log(
    `Heartbeat command received. Lock status: ${
      lockStatus === "0" ? "Locked" : "Unlocked"
    }, Battery voltage: ${voltage}%, Signal strength: ${signalStrength}`
  );

  // Return an empty string or any response if needed
  return ""; // If no response is needed, return an empty string
}

function handleUnlockResponse(parts) {
  const deviceId = parts[2];
  const unlockResult = parts[5];
  const responseUserId = parts[6];
  const responseTimestamp = parts[7].split("#")[0];

  console.log(
    `Unlock result: ${
      unlockResult === "0" ? "Success" : "Failure"
    }, User ID: ${responseUserId}, Timestamp: ${responseTimestamp}`
  );

  if (unlockPromises.has(deviceId)) {
    const { resolve } = unlockPromises.get(deviceId);
    if (resolve) {
      resolve(unlockResult === "0" ? "Success" : "Failure");
      unlockPromises.delete(deviceId);
    }
  } else {
    console.error(`No promise found for device ID ${deviceId}`);
  }

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(
    deviceId,
    "Re",
    CommandType.UNLOCK
  );
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);
  return acknowledgmentCommand;
}

function handleUnlockCommand(deviceId, commandContent, socket) {
  const command = createCommand(deviceId, CommandType.UNLOCK, commandContent);
  console.log(`Sending unlock command to IoT lock: ${command}`);
  sendCommand(command, socket);

  return new Promise((resolve, reject) => {
    // Ensure to handle promises only once per device ID
    if (unlockPromises.has(deviceId)) {
      reject(new Error("Another unlock command is still pending."));
      return;
    }

    unlockPromises.set(deviceId, { resolve, reject });

    // Listen for the response from the IoT device
    socket.once("data", (data) => {
      const response = data.toString().trim();
      console.log(`Received response from IoT lock: ${response}`);

      if (response.startsWith("*CMDR")) {
        const responseParts = response.split(",");
        const unlockResult = responseParts[5];
        const responseUserId = responseParts[6];
        const responseTimestamp = responseParts[7].split("#")[0];

        console.log(
          `Unlock result: ${
            unlockResult === "0" ? "Success" : "Failure"
          }, User ID: ${responseUserId}, Timestamp: ${responseTimestamp}`
        );

        if (unlockPromises.has(deviceId)) {
          const { resolve } = unlockPromises.get(deviceId);
          resolve(unlockResult === "0" ? "Success" : "Failure");
          unlockPromises.delete(deviceId);
        }
      } else {
        if (unlockPromises.has(deviceId)) {
          const { reject } = unlockPromises.get(deviceId);
          reject(new Error("Unexpected response"));
          unlockPromises.delete(deviceId);
        }
      }
    });

    // Timeout handling
    setTimeout(() => {
      if (unlockPromises.has(deviceId)) {
        const { reject } = unlockPromises.get(deviceId);
        reject(new Error("Unlock command timed out"));
        unlockPromises.delete(deviceId);
      }
    }, 10000); // 10 seconds timeout
  });
}

// Express API endpoint to handle unlock requests
app.post("/unlock", async (req, res) => {
  const { deviceId, userId, timestamp } = req.body;
  const commandContent = `0,${userId},${timestamp}`;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the unlock command and wait for the response
      const result = await handleUnlockCommand(
        deviceId,
        commandContent,
        socket
      );
      res.status(200).json({ message: `Unlock command result: ${result}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

function handleLockResponse(parts) {
  const deviceId = parts[2];
  const userId = parts[5]; // User ID from the lock response
  const timestamp = parts[6].split("#")[0]; // Timestamp from the lock response
  const rideTime = parts[7]; // Ride time in minutes from the lock response

  console.log(
    `Lock response received. User ID: ${userId}, Timestamp: ${timestamp}, Ride time: ${rideTime} minutes`
  );

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(deviceId, "Re", CommandType.LOCK);
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);

  // Return the acknowledgment command to be sent
  return acknowledgmentCommand;
}
  

// Add similar functions for other commands...

// Start the TCP server
server.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});

// Start the Express API server
app.listen(API_PORT, () => {
  console.log(`API server listening on port ${API_PORT}`);
});
