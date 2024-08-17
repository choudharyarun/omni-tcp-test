// index.js for Node.js server
const net = require("net");
const express = require("express");
const bodyParser = require("body-parser");
const CommandType = require("./commandTypes");

const app = express();
app.use(bodyParser.json());

const PORT = 8002;
const API_PORT = 3001; // Port for the Express API

const deviceSockets = new Map(); // Map to store device ID and socket connections

// Create a TCP server
const server = net.createServer((socket) => {
  console.log(
    "New connection established:",
    socket.remoteAddress,
    socket.remotePort
  );

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
    console.log("Connection ended:", socket.remoteAddress, socket.remotePort);
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
    case CommandType.CHECK_IN: // Q0
      handleCheckInResponse(parts);
      break;
    case CommandType.HEARTBEAT: // H0
      response = handleHeartbeatResponse(parts);
      break;
    case CommandType.UNLOCK: // L0
      response = handleUnlockResponse(parts);
      break;
    case CommandType.LOCK: // L1
      response = handleLockResponse(parts);
      break;
    case CommandType.LOCATION: // D0
      response = handleRequestPositioningResponse(parts);
      break;
    case CommandType.LOCATION_TRACKING: // D1
      response = handleLocationTrackingResponse(parts);
      break;
    case CommandType.DEVICE_INFO: // S5
      response = handleAccessLockInfoResponse(parts);
      break;
    case CommandType.SEARCH_BIKE: // S8
      response = handleBikeSearchResponse(parts);
      break;
    case CommandType.FIRMWARE_INFO: // G0
      response = handleRequestFirmwareInfoResponse(parts);
      break;
    case CommandType.ALARM: // W0
      response = handleAlarmResponse(parts);
      break;
    case CommandType.UPGRADE_AVAILABLE: // U0
      response = handleUpgradeAvailableResponse(parts);
      break;
    case CommandType.UPGRADE_DATA_REQUEST: // U1
      response = handleUpgradeDataRequestResponse(parts);
      break;
    case CommandType.UPGRADE_RESULTS_NOTIFICATION: // U2
      response = handleUpgradeResultsNotificationResponse(parts);
      break;
    case CommandType.BLE_KEY: // K0
      response = handleBLEKeyResponse(parts);
      break;
    case CommandType.SIM_ICCID: // I0
      response = handleSIMICCIDResponse(parts);
      break;
    case CommandType.BLUETOOTH_MAC: // M0
      response = handleBluetoothMACResponse(parts);
      break;
    case CommandType.RFID_MANAGEMENT: // C1
      response = handleRFIDManagementResponse(parts);
      break;
    case CommandType.WIFI_POSITIONING: // D2
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

function createCommand(deviceId, commandType, commandContent = "") {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, "")
    .slice(2, 14); // Format: yyMMddHHmmss
  const startBit = "0xFFFF"; // Fixed start bit
  const header = "*CMDS"; // Fixed header
  const manufacturerCode = "OM"; // Fixed manufacturer code
  const endMarker = "#"; // Fixed end marker
  const newLine = "\n"; // New line character

  // Construct the command string
  const command = `${startBit}${header},${manufacturerCode},${deviceId},${timestamp},${commandType}${
    commandContent ? `,${commandContent}` : ""
  }${endMarker}${newLine}`;

  return command;
}

// Function to send commands to the IoT lock
function sendCommand(command, socket) {
  console.log(`Sending command to IoT lock: ${command}`);
  socket.write(command);
}

// Function to send a command to all connected devices
function sendCommandToAllDevices(commandType, commandContent = "") {
  for (const [deviceId, socket] of deviceSockets.entries()) {
    const command = createCommand(deviceId, commandType, commandContent);
    console.log(`Sending command to device ${deviceId}: ${command}`);
    sendCommand(command, socket);
  }
}

// Example command handlers
function handleCheckInResponse(parts) {
  // Extract the voltage from the command content
  const voltageStr = parts[5].split("#")[0];
  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Log the voltage
  console.log(`Check-in command received. Battery voltage: ${voltage}%`);

  // No response should be sent back to the IoT lock for the Q0 command response
}

// Function to handle the H0 command (heartbeat)
function handleHeartbeatResponse(parts) {
  // Extract the lock/unlock status, voltage, and network signal strength from the command content
  const lockStatus = parts[5];
  const voltageStr = parts[6];
  const signalStrength = parts[7].split("#")[0];

  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Log the lock/unlock status, battery voltage, and network signal strength
  console.log(
    `Heartbeat command received. Lock status: ${
      lockStatus === "1" ? "Locked" : "Unlocked"
    }, Battery voltage: ${voltage}%, Signal strength: ${signalStrength}`
  );

  // No response should be sent back to the IoT lock for the H0 command response
}

// Function to handle the L0 command (unlock request)
function handleUnlockResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const unlockResult = parts[5];
  const responseUserId = parts[6];
  const operationTimestamp = parts[7].split("#")[0];

  console.log(
    `Lock response received. Device ID: ${deviceId}, Timestamp: ${timestamp}, Unlock result: ${
      unlockResult === "0" ? "Success" : "Failure"
    }, User ID: ${responseUserId}, Operation Timestamp: ${operationTimestamp}`
  );

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(
    deviceId,
    "Re",
    CommandType.UNLOCK
  );
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);
  return acknowledgmentCommand;
}

// Function to handle the L1 command (lock response)
function handleLockResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const userId = parts[5]; // User ID from the lock response
  const operationTimestamp = parts[6]; // Timestamp from the lock response
  const rideTime = parts[7].split("#")[0]; // Ride time in minutes from the lock response

  console.log(
    `Lock response received. Device ID: ${deviceId}, Timestamp: ${timestamp}, User ID: ${userId}, Operation Timestamp: ${operationTimestamp}, Ride time: ${rideTime} minutes`
  );

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(deviceId, "Re", CommandType.LOCK);
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);

  // Return the acknowledgment command to be sent
  return acknowledgmentCommand;
}

// Function to handle the D0 response
function handleRequestPositioningResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const commandStatus = parts[5];
  const utcTime = parts[6];
  const locationStatus = parts[7];
  const latitude = parseFloat(parts[8]);
  const latHemisphere = parts[9];
  const longitude = parseFloat(parts[10]);
  const lonHemisphere = parts[11];
  const satellites = parseInt(parts[12]);
  const hdop = parseFloat(parts[13]);
  const utcDate = parts[14];
  const altitude = parseInt(parts[15]);
  const altitudeUnit = parts[16];
  const mode = parts[17].split("#")[0];

  // Convert latitude and longitude to WGS84 format
  const lat = latitude / 100;
  const lon = longitude / 100;

  // Apply hemisphere correction
  const latWGS84 = latHemisphere === "N" ? lat : -lat;
  const lonWGS84 = lonHemisphere === "E" ? lon : -lon;

  console.log(`Positioning response received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Command Status: ${commandStatus}`);
  console.log(`UTC Time: ${utcTime}`);
  console.log(`Location Status: ${locationStatus}`);
  console.log(`Latitude: ${latWGS84}`);
  console.log(`Longitude: ${lonWGS84}`);
  console.log(`Satellites: ${satellites}`);
  console.log(`HDOP: ${hdop}`);
  console.log(`UTC Date: ${utcDate}`);
  console.log(`Altitude: ${altitude} ${altitudeUnit}`);
  console.log(`Mode: ${mode}`);

  // Construct and send acknowledgment command
  const acknowledgmentCommand = createCommand(
    deviceId,
    "Re",
    CommandType.LOCATION
  );
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);

  // Return the acknowledgment command to be sent
  return acknowledgmentCommand;
}

// Function to handle the D1 response
function handleLocationTrackingResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const interval = parts[5].split("#")[0];

  console.log(
    `Location tracking response (D1) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Upload location interval: ${interval} seconds`);

  // No response should be sent back to the IoT lock for the D1 command response
}

// Function to handle the S5 response
function handleAccessLockInfoResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const voltageStr = parts[5];
  const signalStrength = parts[6];
  const gpsSatellites = parts[7];
  const lockStatus = parts[8];
  const retention = parts[9].split("#")[0];

  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  console.log(
    `Access lock information response (S5) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Voltage: ${voltage} V`);
  console.log(`Network signal strength: ${signalStrength}`);
  console.log(`GPS satellites: ${gpsSatellites}`);
  console.log(`Lock status: ${lockStatus === "1" ? "Locked" : "Unlocked"}`);
  console.log(`Retention: ${retention}`);

  // No response should be sent back to the IoT lock for the S5 command response
}

// Function to handle the S8 response
function handleBikeSearchResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const ringTimes = parts[5];
  const reserve = parts[6].split("#")[0];

  console.log(`Bike search response (S8) received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Ring times: ${ringTimes}`);
  console.log(`Reserve: ${reserve}`);

  // No response should be sent back to the IoT lock for the S8 command response
}

// Function to handle the G0 response
function handleRequestFirmwareInfoResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const firmwareVersion = parts[5];
  const compilationDate = parts[6].split("#")[0];

  // Extract device type identification code and software version number
  const deviceTypeCode = firmwareVersion.split("_")[0];
  const versionNumber = firmwareVersion.split("_")[1];

  // Convert version number to Vx.y.z format
  const majorVersion = versionNumber[0];
  const minorVersion = versionNumber[1];
  const patchVersion = versionNumber[2];
  const formattedVersion = `V${majorVersion}.${minorVersion}.${patchVersion}`;

  console.log(
    `Firmware information response (G0) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Device Type Code: ${deviceTypeCode}`);
  console.log(`Firmware Version: ${formattedVersion}`);
  console.log(`Compilation Date: ${compilationDate}`);

  // No response should be sent back to the IoT lock for the G0 command response
}

// Function to handle the W0 response (alarm)
function handleAlarmResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const alarmType = parts[5].split("#")[0];

  let alarmDescription;
  switch (alarmType) {
    case "1":
      alarmDescription = "Illegal movement alarm";
      break;
    case "2":
      alarmDescription = "Fall alarm";
      break;
    case "3":
      alarmDescription = "Clear fall alarm (bike picked up)";
      break;
    default:
      alarmDescription = "Unknown alarm type";
  }

  console.log(`Alarm response (W0) received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Alarm Type: ${alarmType} (${alarmDescription})`);

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(
    deviceId,
    "Re",
    CommandType.ALARM
  );
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);
  return acknowledgmentCommand;
}

// Function to handle the U0 response (upgrade available)
function handleUpgradeAvailableResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const versionNumber = parts[5];
  const deviceTypeCode = parts[6];
  const compilationDate = parts[7].split("#")[0];

  // Convert version number to Vx.y.z format
  const majorVersion = versionNumber[0];
  const minorVersion = versionNumber[1];
  const patchVersion = versionNumber[2];
  const formattedVersion = `V${majorVersion}.${minorVersion}.${patchVersion}`;

  console.log(
    `Upgrade available response (U0) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Software Version: ${formattedVersion}`);
  console.log(`Device Type Code: ${deviceTypeCode}`);
  console.log(`Compilation Date: ${compilationDate}`);

  // No response should be sent back to the IoT lock for the U0 command response
}

// TODO: Implement U1 command response (for upgrade data request)
// Function to handle the U1 response (request upgrade data)
function handleUpgradeDataRequestResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const packageNumber = parts[5];
  const deviceIdentificationCode = parts[6].split("#")[0];

  console.log(`Upgrade data request (U1) received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Package number: ${packageNumber}`);
  console.log(`Device identification code: ${deviceIdentificationCode}`);

  // Retrieve the upgrade data and CRC16 check value for the requested package
  const upgradeData = getUpgradeData(packageNumber);
  const crc16 = calculateCRC16(upgradeData);

  // Construct the response command
  const responseCommand = createCommand(
    deviceId,
    CommandType.UPGRADE_DATA_REQUEST,
    `${packageNumber},${crc16},${upgradeData}`
  );

  console.log(`Sending upgrade data response to IoT lock: ${responseCommand}`);
  return responseCommand;
}

// Helper function to retrieve upgrade data for the specified package number
function getUpgradeData(packageNumber) {
  // TODO: Implement actual data retrieval logic
  // Retrieve the upgrade data for the specified package number
  // This is a placeholder implementation; replace with actual data retrieval logic
  return "DATA";
}

// Helper function to calculate the CRC16 check value for the given data
function calculateCRC16(data) {
  // TODO: Implement actual CRC16 calculation logic
  // Calculate the CRC16 check value for the given data
  // This is a placeholder implementation; replace with actual CRC16 calculation logic
  return "1234";
}

// Function to handle the U2 response (notification of upgrade results)
function handleUpgradeResultsNotificationResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const deviceTypeCode = parts[5];
  const upgradeResult = parts[6].split("#")[0];

  const resultDescription = upgradeResult === "0" ? "Success" : "Failure";

  console.log(
    `Upgrade results notification (U2) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Device Type Code: ${deviceTypeCode}`);
  console.log(`Upgrade Result: ${resultDescription}`);

  // No response should be sent back to the IoT lock for the U2 command response
}

// Function to handle the K0 response (set/get BLE 8 byte communication KEY)
function handleBLEKeyResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const bleKey = parts[5].split("#")[0];

  console.log(`BLE key response (K0) received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`BLE 8 byte communication KEY: ${bleKey}`);

  // No response should be sent back to the IoT lock for the K0 command response
}

// Function to handle the I0 response (obtain SIM ICCID number)
function handleSIMICCIDResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const iccid = parts[5].split("#")[0];

  console.log(`SIM ICCID response (I0) received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`ICCID: ${iccid}`);

  // No response should be sent back to the IoT lock for the I0 command response
}

// Function to handle the M0 response (get Bluetooth MAC address)
function handleBluetoothMACResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const macAddress = parts[5].split("#")[0];

  console.log(
    `Bluetooth MAC address response (M0) received from device ${deviceId}:`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`MAC Address: ${macAddress}`);

  // No response should be sent back to the IoT lock for the M0 command response
}

// Function to handle the C1 response (Management RFID number setting)
function handleRFIDManagementResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const adminBikeNumber = parts[5].split("#")[0];

  console.log(`RFID management response received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Administrator bike number: ${adminBikeNumber}`);
}

// Function to handle the D2 response (WIFI positioning)
function handleWIFIPositioningResponse(parts) {
  const deviceId = parts[2];
  const timestamp = parts[3];
  const positionMode = parts[5];
  const scanTime = parts[6];
  const wifiData = parts.slice(7, 17).join(",");

  // Descriptive string for the position mode
  let positionModeDescription;
  switch (positionMode) {
    case "1":
      positionModeDescription =
        "Does not upload WIFI location information (default)";
      break;
    case "2":
      positionModeDescription = "Upload GPS data in D0 command when invalid";
      break;
    case "3":
      positionModeDescription = "Upload D0 command actively";
      break;
    default:
      positionModeDescription = "Unknown mode";
  }

  console.log(`WIFI positioning response received from device ${deviceId}:`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Position mode: ${positionMode} (${positionModeDescription})`);
  console.log(`Scan time: ${scanTime}`);
  console.log(`WIFI data: ${wifiData}`);
}

// Function to handle the L0 command (unlock request)
function handleUnlockCommand(deviceId, commandContent, socket) {
  const command = createCommand(deviceId, CommandType.UNLOCK, commandContent);
  console.log(`Sending unlock command to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle unlock requests
app.post("/unlock", async (req, res) => {
  const { deviceId, userId, timestamp } = req.body;
  const commandContent = `0,${userId},${timestamp}`;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the unlock command
      handleUnlockCommand(deviceId, commandContent, socket);
      res.status(200).json({ message: "Unlock command sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the D0 command
function handleRequestPositioningCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.LOCATION);
  console.log(
    `Sending positioning request command (D0) to IoT lock: ${command}`
  );
  sendCommand(command, socket);
}

// Express API endpoint to handle positioning requests
app.post("/location", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the positioning request command
      handleRequestPositioningCommand(deviceId, socket);
      res.status(200).json({ message: "Positioning request sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the D1 command
function handleLocationTrackingCommand(deviceId, commandContent, socket) {
  const command = createCommand(
    deviceId,
    CommandType.LOCATION_TRACKING,
    commandContent
  );
  console.log(`Sending location tracking command (D1) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle location tracking requests
app.post("/location-tracking", async (req, res) => {
  const { deviceId, interval } = req.body; // 'interval' is the upload location interval in seconds

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the location tracking command
      handleLocationTrackingCommand(deviceId, interval.toString(), socket);
      res.status(200).json({ message: "Location tracking command sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the S5 command
function handleAccessLockInfoCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.DEVICE_INFO);
  console.log(
    `Sending access lock information command (S5) to IoT lock: ${command}`
  );
  sendCommand(command, socket);
}

// Express API endpoint to handle access lock information requests
app.post("/device-info", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the access lock information command
      handleAccessLockInfoCommand(deviceId, socket);
      res.status(200).json({ message: "Access lock information command sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the S8 command
function handleBikeSearchCommand(deviceId, ringTimes, socket) {
  const commandContent = `${ringTimes},0`;
  const command = createCommand(
    deviceId,
    CommandType.SEARCH_BIKE,
    commandContent
  );
  console.log(`Sending bike search command (S8) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle bike search requests
app.post("/search-bike", async (req, res) => {
  const { deviceId, ringTimes } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the bike search command
      handleBikeSearchCommand(deviceId, ringTimes.toString(), socket);
      res.status(200).json({ message: "Bike search command sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the G0 command
function handleRequestFirmwareInfoCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.FIRMWARE_INFO);
  console.log(
    `Sending firmware information request command (G0) to IoT lock: ${command}`
  );
  sendCommand(command, socket);
}

// Express API endpoint to handle firmware information requests
app.post("/firmware-info", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      // Send the firmware information request command
      handleRequestFirmwareInfoCommand(deviceId, socket);
      res.status(200).json({ message: "Firmware information request sent" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to send the U0 command (initiate upgrade)
function sendUpgradeCommand(
  deviceId,
  upgradeDataPackage,
  dataLengthPerPackage,
  crc16,
  deviceTypeCode,
  upgradeKey,
  socket
) {
  const commandContent = `${upgradeDataPackage},${dataLengthPerPackage},${crc16},${deviceTypeCode},${upgradeKey}`;
  const command = createCommand(
    deviceId,
    CommandType.UPGRADE_AVAILABLE,
    commandContent
  );
  console.log(`Sending upgrade command (U0) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to initiate an upgrade
app.post("/start-upgrade", async (req, res) => {
  const {
    deviceId,
    upgradeDataPackage,
    dataLengthPerPackage,
    crc16,
    deviceTypeCode,
    upgradeKey,
  } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    try {
      sendUpgradeCommand(
        deviceId,
        upgradeDataPackage,
        dataLengthPerPackage,
        crc16,
        deviceTypeCode,
        upgradeKey,
        socket
      );
      res.status(200).json({ message: "Upgrade command sent successfully" });
    } catch (error) {
      console.error("Error sending upgrade command:", error);
      res.status(500).json({ error: "Failed to send upgrade command" });
    }
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the K0 command
function handleBLEKeyCommand(deviceId, action, bleKey, socket) {
  const commandContent = action === 0 ? "0," : `1,${bleKey}`;
  const command = createCommand(deviceId, CommandType.BLE_KEY, commandContent);
  console.log(`Sending BLE key command (K0) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle BLE key requests
app.post("/ble-key", async (req, res) => {
  const { deviceId, action, bleKey } = req.body; // 'action' is 0 for read, 1 for set

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleBLEKeyCommand(deviceId, action, bleKey, socket);
    res.status(200).json({ message: "BLE key command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the I0 command (obtain SIM ICCID number)
function handleSIMICCIDCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.SIM_ICCID);
  console.log(`Sending SIM ICCID command (I0) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle SIM ICCID requests
app.post("/sim-iccid", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleSIMICCIDCommand(deviceId, socket);
    res.status(200).json({ message: "SIM ICCID command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the M0 command (get Bluetooth MAC address)
function handleBluetoothMACCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.BLUETOOTH_MAC);
  console.log(
    `Sending Bluetooth MAC address command (M0) to IoT lock: ${command}`
  );
  sendCommand(command, socket);
}

// Express API endpoint to handle Bluetooth MAC address requests
app.post("/bluetooth-mac", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleBluetoothMACCommand(deviceId, socket);
    res
      .status(200)
      .json({ message: "Bluetooth MAC address command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the S0 command (shutdown)
function handleShutdownCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.SHUTDOWN);
  console.log(`Sending shutdown command (S0) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle shutdown requests
// TODO: As this command is used for shutdown during transportation, we first need
// to make sure that the device is unlocked the before shutdown. To boot device, simply
// lock it manually or it will be booted up once put into charge.
app.post("/shutdown", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleShutdownCommand(deviceId, socket);
    res.status(200).json({ message: "Shutdown command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the S1 command (reboot)
function handleRebootCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.REBOOT);
  console.log(`Sending reboot command (S1) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle reboot requests
app.post("/reboot", async (req, res) => {
  const { deviceId } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleRebootCommand(deviceId, socket);
    res.status(200).json({ message: "Reboot command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the C0 command (RFID unlock request)
function handleRFIDUnlockCommand(deviceId, bikeNumber, socket) {
  const actionRequested = "0"; // 0 means unlock operation
  const retention = "0"; // Fill in 0
  const commandContent = `${actionRequested},${retention},${bikeNumber}`;
  const command = createCommand(
    deviceId,
    CommandType.RFID_UNLOCK,
    commandContent
  );
  console.log(`Sending RFID unlock command (C0) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle RFID unlock requests
app.post("/rfid-unlock", async (req, res) => {
  const { deviceId, bikeNumber } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleRFIDUnlockCommand(deviceId, bikeNumber, socket);
    res.status(200).json({ message: "RFID unlock command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the C1 command (Management RFID number setting)
function handleRFIDManagementCommand(
  deviceId,
  operation,
  adminBikeNumber,
  socket
) {
  const commandContent = `${operation},${
    operation === "1" || operation === "2" ? "0" : adminBikeNumber
  }`;
  const command = createCommand(
    deviceId,
    CommandType.RFID_MANAGEMENT,
    commandContent
  );
  console.log(`Sending RFID management command (C1) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle RFID management requests
app.post("/rfid-management", async (req, res) => {
  const { deviceId, operation, adminBikeNumber } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleRFIDManagementCommand(deviceId, operation, adminBikeNumber, socket);
    res
      .status(200)
      .json({ message: "RFID management command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Function to handle the D2 command (WIFI positioning)
function handleWIFIPositioningCommand(
  deviceId,
  positionMode,
  scanTime,
  socket
) {
  const commandContent = `${positionMode},${scanTime}`;
  const command = createCommand(
    deviceId,
    CommandType.WIFI_POSITIONING,
    commandContent
  );
  console.log(`Sending WIFI positioning command (D2) to IoT lock: ${command}`);
  sendCommand(command, socket);
}

// Express API endpoint to handle WIFI positioning requests
app.post("/wifi-positioning", async (req, res) => {
  const { deviceId, positionMode, scanTime } = req.body;

  const socket = deviceSockets.get(deviceId);
  if (socket) {
    handleWIFIPositioningCommand(deviceId, positionMode, scanTime, socket);
    res
      .status(200)
      .json({ message: "WIFI positioning command sent successfully" });
  } else {
    res.status(404).json({ error: "Device not connected" });
  }
});

// Add similar API endpoints for other commands...

// Start the TCP server
server.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});

// Start the Express API server
app.listen(API_PORT, () => {
  console.log(`API server listening on port ${API_PORT}`);
});
