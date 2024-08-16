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

  // No response should be sent back to the IoT lock for the H0 command response
}

function handleUnlockResponse(parts) {
  const deviceId = parts[2];
  const unlockResult = parts[5];
  const responseUserId = parts[6];
  const responseTimestamp = parts[7].split("#")[0];

  console.log(
    `Unlock result: ${
      unlockResult === "0" ? "Success" : "Failure"
    }, User ID: ${responseUserId}, Timestamp: ${responseTimestamp}, Device ID: ${deviceId}`
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

function handleUnlockCommand(deviceId, commandContent, socket) {
  const command = createCommand(deviceId, CommandType.UNLOCK, commandContent);
  console.log(`Sending unlock command to IoT lock: ${command}`);
  sendCommand(command, socket);
}

function handleLockResponse(parts) {
  const deviceId = parts[2];
  const userId = parts[5]; // User ID from the lock response
  const operationTimestamp = parts[6]; // Timestamp from the lock response
  const rideTime = parts[7].split("#")[0]; // Ride time in minutes from the lock response

  console.log(
    `Lock response received. User ID: ${userId}, Timestamp: ${operationTimestamp}, Ride time: ${rideTime} minutes`
  );

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(deviceId, "Re", CommandType.LOCK);
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);

  // Return the acknowledgment command to be sent
  return acknowledgmentCommand;
}

function handleRequestPositioningResponse(parts) {
  const deviceId = parts[2];
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
    CommandType.REQUEST_POSITIONING
  );
  console.log(`Sending acknowledgment to IoT lock: ${acknowledgmentCommand}`);

  // Return the acknowledgment command to be sent
  return acknowledgmentCommand;
}

function handleRequestPositioningCommand(deviceId, socket) {
  const command = createCommand(deviceId, CommandType.REQUEST_POSITIONING);
  console.log(`Sending positioning request command to IoT lock: ${command}`);
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

// Add similar functions for other commands...

// Start the TCP server
server.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});

// Start the Express API server
app.listen(API_PORT, () => {
  console.log(`API server listening on port ${API_PORT}`);
});
