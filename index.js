// index.js for Node.js server
require('dotenv').config();
const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const CommandType = require('./commandTypes');
const admin = require('firebase-admin');
const http = require('http');
const socketIo = require('socket.io');

// Parse the service account key from the environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(bodyParser.json());

const PORT = 8002; // Port for the TCP server
const API_PORT = 3001; // Port for the Express API

const deviceSockets = new Map(); // Map to store device ID and socket connections

// Create an HTTP server to use with Express and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Adjust this as needed
    methods: ['GET', 'POST'],
  },
});

// Create a TCP server
const tcpServer = net.createServer((socket) => {
  console.log(
    'New connection established:',
    socket.remoteAddress,
    socket.remotePort
  );

  socket.on('data', (data) => {
    const command = data.toString().trim();
    console.log('Received data:', command);

    if (command.startsWith('*CMDR')) {
      const parts = command.split(',');
      const deviceId = parts[2];

      // Store the socket connection using the device ID
      deviceSockets.set(deviceId, socket);

      // Handle the incoming command
      handleIncomingData(command, socket);
    }
  });

  socket.on('end', () => {
    console.log('Connection ended:', socket.remoteAddress, socket.remotePort);

    // Remove the socket from the map when the connection ends
    for (const [deviceId, deviceSocket] of deviceSockets.entries()) {
      if (deviceSocket === socket) {
        deviceSockets.delete(deviceId);
        break;
      }
    }
  });

  socket.on('error', (err) => {
    console.log(
      'Connection error:',
      socket.remoteAddress,
      socket.remotePort,
      err.message
    );

    // Remove the socket from the map when an error occurs
    for (const [deviceId, deviceSocket] of deviceSockets.entries()) {
      if (deviceSocket === socket) {
        deviceSockets.delete(deviceId);
        break;
      }
    }
  });
});

// Function to handle commands from the IoT device
function handleIncomingData(command) {
  const parts = command.split(',');
  const action = parts[4];

  switch (action) {
    case CommandType.CHECK_IN: // Q0
      handleCheckInResponse(parts);
      break;
    case CommandType.HEARTBEAT: // H0
      handleHeartbeatResponse(parts);
      break;
    case CommandType.UNLOCK: // L0
      handleUnlockResponse(parts);
      break;
    case CommandType.LOCK: // L1
      handleLockResponse(parts);
      break;
    case CommandType.LOCATION: // D0
      handleRequestPositioningResponse(parts);
      break;
    case CommandType.LOCATION_TRACKING: // D1
      handleLocationTrackingResponse(parts);
      break;
    case CommandType.STATUS: // S5
      handleStatusResponse(parts);
      break;
    case CommandType.ACTIVATE_ALARM: // S8
      handleActivateAlarmResponse(parts);
      break;
    case CommandType.FIRMWARE_INFO: // G0
      handleRequestFirmwareInfoResponse(parts);
      break;
    case CommandType.ALARM: // W0
      handleAlarmResponse(parts);
      break;
    case CommandType.UPGRADE_AVAILABLE: // U0
      handleUpgradeAvailableResponse(parts);
      break;
    case CommandType.UPGRADE_DATA_REQUEST: // U1
      handleUpgradeDataRequestResponse(parts);
      break;
    case CommandType.UPGRADE_RESULTS_NOTIFICATION: // U2
      handleUpgradeResultsNotificationResponse(parts);
      break;
    case CommandType.BLE_KEY: // K0
      handleBLEKeyResponse(parts);
      break;
    case CommandType.SIM_ICCID: // I0
      handleSIMICCIDResponse(parts);
      break;
    case CommandType.BLUETOOTH_MAC: // M0
      handleBluetoothMACResponse(parts);
      break;
    case CommandType.RFID_UNLOCK: // C0
      handleRfidCardUnlockRequest(parts);
      break;
    case CommandType.RFID_MANAGEMENT: // C1
      handleRFIDManagementResponse(parts);
      break;
    default:
      console.log('Unknown action:', action);
  }
}

// Function to update Firestore with the specified fields
async function updateFirestore(deviceId, updateData) {
  try {
    const iotRef = db.collection('IoTs').doc(deviceId);
    await iotRef.update(updateData);
  } catch (error) {
    console.error('Error updating Firestore:', error);
  }
}

// Function to create a command string
function createCommand(deviceId, commandType, commandContent = '') {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, '')
    .slice(2, 14); // Format: yyMMddHHmmss
  const startBit = '0xFFFF'; // Fixed start bit
  const header = '*CMDS'; // Fixed header
  const manufacturerCode = 'OM'; // Fixed manufacturer code
  const endMarker = '#'; // Fixed end marker
  const newLine = '\n'; // New line character

  // Construct the command string
  const command = `${startBit}${header},${manufacturerCode},${deviceId},${timestamp},${commandType}${
    commandContent ? `,${commandContent}` : ''
  }${endMarker}${newLine}`;

  return command;
}

// Function to send commands to the IoT lock
function sendCommand(deviceId, command) {
  const socket = deviceSockets.get(deviceId);
  if (!socket) {
    console.error(`Error: Device ${deviceId} is not connected.`);
    throw new Error(`Device ${deviceId} is not connected.`);
  }

  if (socket.destroyed) {
    console.error(`Error: Socket for device ${deviceId} is destroyed.`);
    throw new Error(`Socket for device ${deviceId} is destroyed.`);
  }

  try {
    console.log(`Sending command to device: ${command}`);
    socket.write(command);
  } catch (error) {
    console.error('Error sending command to device:', error);
    throw new Error(`Error sending command to device: ${error.message}`);
  }
}

// Function to send a command to all connected devices
function sendCommandToAllDevices(commandType, commandContent = '') {
  for (const [deviceId, socket] of deviceSockets.entries()) {
    const command = createCommand(deviceId, commandType, commandContent);
    console.log(`Sending command to device ${deviceId}: ${command}`);
    sendCommand(deviceId, command);
  }
}

function getBatteryPercentage(voltage) {
  if (voltage >= 4.2) {
    return 100;
  } else if (voltage >= 4.116) {
    return 95;
  } else if (voltage >= 3.9561) {
    return 90;
  } else if (voltage >= 3.8687) {
    return 80;
  } else if (voltage >= 3.7946) {
    return 70;
  } else if (voltage >= 3.7344) {
    return 60;
  } else if (voltage >= 3.6982) {
    return 50;
  } else if (voltage >= 3.6548) {
    return 40;
  } else if (voltage >= 3.632) {
    return 30;
  } else if (voltage >= 3.5966) {
    return 20;
  } else if (voltage >= 3.5473) {
    return 10;
  } else {
    return 0;
  }
}

// Function to handle the Q0 command (check-in)
function handleCheckInResponse(parts) {
  // Extract the voltage from the command content
  const deviceId = parts[2];
  const voltageStr = parts[5].split('#')[0];
  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Determine the battery percentage based on the voltage
  const batteryPercentage = getBatteryPercentage(voltage);

  // Log the voltage
  console.log(
    `Check-in command response (Q0) received. Device ID: ${deviceId}, Battery percentage: ${batteryPercentage}%`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    voltage: voltage,
    battery: batteryPercentage,
  });

  // No response should be sent back to the IoT lock for the Q0 command response
}

// Function to handle the H0 command (heartbeat)
function handleHeartbeatResponse(parts) {
  // Extract the lock/unlock status, voltage, and network signal strength from the command content
  const deviceId = parts[2];
  const lockStatus = parts[5];
  const voltageStr = parts[6];
  const signalStrengthStr = parts[7].split('#')[0];

  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Determine the battery percentage based on the voltage
  const batteryPercentage = getBatteryPercentage(voltage);

  // Convert lockStatus to boolean
  const isLocked = lockStatus === '1';

  // Convert signalStrength to number
  const signalStrength = parseInt(signalStrengthStr, 10);

  // Log the lock/unlock status, battery voltage, and network signal strength
  console.log(
    `Heartbeat response (H0) received. Device ID: ${deviceId}, Lock status: ${
      isLocked ? 'Locked' : 'Unlocked'
    }, Battery percentage: ${batteryPercentage}%, Signal strength: ${signalStrength}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    voltage: voltage,
    isLocked: isLocked,
    battery: batteryPercentage,
    signalStrength: signalStrength,
  });

  // No response should be sent back to the IoT lock for the H0 command response
}

// Function to handle the L0 command (unlock request)
function handleUnlockResponse(parts) {
  const deviceId = parts[2];
  const unlockResult = parts[5];
  const responseUserId = parts[6];
  const operationTimestamp = parts[7].split('#')[0];

  console.log(
    `Unlock response (L0) received. Device ID: ${deviceId}, Unlock result: ${
      unlockResult === '0' ? 'Success' : 'Failure'
    }, User ID: ${responseUserId}, Operation Timestamp: ${operationTimestamp}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    isLocked: unlockResult !== '0', // Set isLocked to false if unlockResult is "0"
  });

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(
    deviceId,
    'Re',
    CommandType.UNLOCK
  );
  sendCommand(deviceId, acknowledgmentCommand);
}

// Function to handle the L1 command (lock response)
function handleLockResponse(parts) {
  const deviceId = parts[2];
  const userId = parts[5]; // User ID from the lock response
  const operationTimestamp = parts[6]; // Timestamp from the lock response
  const rideTime = parts[7].split('#')[0]; // Ride time in minutes from the lock response

  console.log(
    `Lock response (L1) received. Device ID: ${deviceId}, User ID: ${userId}, Operation Timestamp: ${operationTimestamp}, Ride time: ${rideTime} minutes`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    isLocked: true,
  });

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(deviceId, 'Re', CommandType.LOCK);
  sendCommand(deviceId, acknowledgmentCommand);
}

// Function to handle the D0 response
function handleRequestPositioningResponse(parts) {
  const deviceId = parts[2];
  const commandStatus = parts[5];
  const utcTime = parts[6];
  const locationStatus = parts[7];

  // Construct and send acknowledgment command
  const acknowledgmentCommand = createCommand(
    deviceId,
    'Re',
    CommandType.LOCATION
  );

  // Check if the location status is invalid
  if (locationStatus === 'V') {
    console.log(
      `Invalid location data received from device ${deviceId}. Skipping save.`
    );
    sendCommand(deviceId, acknowledgmentCommand);
    return;
  }

  const latitude = parseFloat(parts[8]);
  const latHemisphere = parts[9];
  const longitude = parseFloat(parts[10]);
  const lonHemisphere = parts[11];
  const satellites = parseInt(parts[12]);
  const hdop = parseFloat(parts[13]);
  const utcDate = parts[14];
  const altitude = parseInt(parts[15]);
  const altitudeUnit = parts[16];
  const mode = parts[17].split('#')[0];

  // Check if latitude and longitude have valid lengths
  if (
    latitude.length === 0 ||
    longitude.length === 0 ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    console.error(
      `Invalid latitude or longitude received from device ${deviceId}. Skipping save.`
    );
    sendCommand(deviceId, acknowledgmentCommand);
    return;
  }

  // Convert latitude and longitude to WGS84 format
  const latDegrees = Math.floor(latitude / 100);
  const latMinutes = latitude % 100;
  const lat = latDegrees + latMinutes / 60;

  const lonDegrees = Math.floor(longitude / 100);
  const lonMinutes = longitude % 100;
  const lon = lonDegrees + lonMinutes / 60;

  // Apply hemisphere correction
  const latWGS84 = (latHemisphere === 'N' ? lat : -lat).toFixed(7);
  const lonWGS84 = (lonHemisphere === 'E' ? lon : -lon).toFixed(7);

  console.log(
    `Positioning response (D0) received. Device ID: ${deviceId}, Command Status: ${commandStatus}, UTC Time: ${utcTime}, Location Status: ${locationStatus}, Latitude: ${latWGS84}, Longitude: ${lonWGS84}, Satellites: ${satellites}, HDOP: ${hdop}, UTC Date: ${utcDate}, Altitude: ${altitude} ${altitudeUnit}, Mode: ${mode}`
  );
  // Update Firestore
  updateFirestore(deviceId, {
    location: new admin.firestore.GeoPoint(
      parseFloat(latWGS84),
      parseFloat(lonWGS84)
    ),
  });

  // Send the acknowledgment command
  sendCommand(deviceId, acknowledgmentCommand);
}

// Function to handle the D1 response
function handleLocationTrackingResponse(parts) {
  const deviceId = parts[2];
  const interval = parts[5].split('#')[0];

  console.log(
    `Location tracking response (D1) received. Device ID: ${deviceId}, Upload location interval: ${interval} seconds`
  );

  // No response should be sent back to the IoT lock for the D1 command response
}

// Function to handle the S5 response
function handleStatusResponse(parts) {
  const deviceId = parts[2];
  const voltageStr = parts[5];
  const signalStrengthStr = parts[6];
  const gpsSatellites = parts[7];
  const lockStatus = parts[8];
  const retention = parts[9].split('#')[0];

  const voltage = parseFloat(voltageStr) / 100; // Convert to volts

  // Determine the battery percentage based on the voltage
  const batteryPercentage = getBatteryPercentage(voltage);

  // Convert lockStatus to boolean
  const isLocked = lockStatus === '1';

  // Convert signalStrength to number
  const signalStrength = parseInt(signalStrengthStr, 10);

  console.log(
    `Access lock information response (S5) received. Device ID: ${deviceId}, Voltage: ${voltage} V, Network signal strength: ${signalStrength}, GPS satellites: ${gpsSatellites}, Lock status: ${
      isLocked ? 'Locked' : 'Unlocked'
    }, Retention: ${retention}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    voltage: voltage,
    isLocked: isLocked,
    battery: batteryPercentage,
    signalStrength: signalStrength,
  });

  // No response should be sent back to the IoT lock for the S5 command response
}

// Function to handle the S8 response
function handleActivateAlarmResponse(parts) {
  const deviceId = parts[2];
  const ringTimes = parts[5];
  const reserve = parts[6].split('#')[0];

  console.log(
    `Activate alarm response (S8) received. Device ID: ${deviceId}, Ring times: ${ringTimes}, Reserve: ${reserve}`
  );

  // No response should be sent back to the IoT lock for the S8 command response
}

// Function to handle the G0 response
function handleRequestFirmwareInfoResponse(parts) {
  const deviceId = parts[2];
  const firmwareVersion = parts[5];
  const compilationDate = parts[6].split('#')[0];

  // Extract device type identification code and software version number
  const deviceTypeCode = firmwareVersion.split('_')[0];
  const versionNumber = firmwareVersion.split('_')[1];

  console.log(
    `Firmware information response (G0) received. Device ID: ${deviceId}, Device Type Code: ${deviceTypeCode}, Firmware Version: ${versionNumber}, Compilation Date: ${compilationDate}`
  );

  // Update Firestore with firmware version and compilation date in a map
  updateFirestore(deviceId, {
    firmware: {
      version: versionNumber,
      date: compilationDate,
    },
  });

  // No response should be sent back to the IoT lock for the G0 command response
}

// Function to handle the W0 response (alarm)
function handleAlarmResponse(parts) {
  const deviceId = parts[2];
  const alarmType = parseInt(parts[5].split('#')[0], 10);

  let alarmDescription;
  switch (alarmType) {
    case 1:
      alarmDescription = 'Illegal movement alarm';
      break;
    case 2:
      alarmDescription = 'Fall alarm';
      break;
    case 6:
      alarmDescription = 'Vehicle picked up alarm';
      break;
    default:
      alarmDescription = 'Unknown alarm type';
  }

  console.log(
    `Alarm response (W0) received. Device ID: ${deviceId}, Alarm Type: ${alarmType} (${alarmDescription})`
  );

  // Update Firestore with alarm information as a map
  updateFirestore(deviceId, {
    alarm: {
      type: alarmType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  // Emit the alarm event to all connected clients
  io.emit('fallAlarm', {
    deviceId: deviceId,
    timestamp: Date.now(), // Use current timestamp
    alarmType: alarmType,
  });

  // Construct and send the acknowledgment command back to the IoT lock
  const acknowledgmentCommand = createCommand(
    deviceId,
    'Re',
    CommandType.ALARM
  );
  sendCommand(deviceId, acknowledgmentCommand);
}

// Function to handle the U0 response (upgrade available)
function handleUpgradeAvailableResponse(parts) {
  const deviceId = parts[2];
  const versionNumber = parts[5];
  const deviceTypeCode = parts[6];
  const compilationDate = parts[7].split('#')[0];

  // Convert version number to Vx.y.z format
  const majorVersion = versionNumber[0];
  const minorVersion = versionNumber[1];
  const patchVersion = versionNumber[2];
  const formattedVersion = `V${majorVersion}.${minorVersion}.${patchVersion}`;

  console.log(
    `Upgrade available response (U0) received. Device ID: ${deviceId}, Software Version: ${formattedVersion}, Device Type Code: ${deviceTypeCode}, Compilation Date: ${compilationDate}`
  );

  // No response should be sent back to the IoT lock for the U0 command response
}

// TODO: Implement U1 command response (for upgrade data request)
// Function to handle the U1 response (request upgrade data)
function handleUpgradeDataRequestResponse(parts) {
  const deviceId = parts[2];
  const packageNumber = parts[5];
  const deviceIdentificationCode = parts[6].split('#')[0];

  console.log(
    `Upgrade data request (U1) received. Device ID: ${deviceId}, Package number: ${packageNumber}, Device identification code: ${deviceIdentificationCode}`
  );

  // Retrieve the upgrade data and CRC16 check value for the requested package
  const upgradeData = getUpgradeData(packageNumber);
  const crc16 = calculateCRC16(upgradeData);

  // Construct the response command
  const responseCommand = createCommand(
    deviceId,
    CommandType.UPGRADE_DATA_REQUEST,
    `${packageNumber},${crc16},${upgradeData}`
  );
  sendCommand(deviceId, responseCommand);
}

// Helper function to retrieve upgrade data for the specified package number
function getUpgradeData(packageNumber) {
  // TODO: Implement actual data retrieval logic
  // Retrieve the upgrade data for the specified package number
  // This is a placeholder implementation; replace with actual data retrieval logic
  return 'DATA';
}

// Helper function to calculate the CRC16 check value for the given data
function calculateCRC16(data) {
  // TODO: Implement actual CRC16 calculation logic
  // Calculate the CRC16 check value for the given data
  // This is a placeholder implementation; replace with actual CRC16 calculation logic
  return '1234';
}

// Function to handle the U2 response (notification of upgrade results)
function handleUpgradeResultsNotificationResponse(parts) {
  const deviceId = parts[2];
  const deviceTypeCode = parts[5];
  const upgradeResult = parts[6].split('#')[0];

  const resultDescription = upgradeResult === '0' ? 'Success' : 'Failure';

  console.log(
    `Upgrade results notification (U2) received. Device ID: ${deviceId}, Device Type Code: ${deviceTypeCode}, Upgrade Result: ${resultDescription}`
  );

  // No response should be sent back to the IoT lock for the U2 command response
}

// Function to handle the K0 response (set/get BLE 8 byte communication KEY)
function handleBLEKeyResponse(parts) {
  const deviceId = parts[2];
  const bleKey = parts[5].split('#')[0];

  console.log(
    `BLE key response (K0) received. Device ID: ${deviceId}, BLE 8 byte communication KEY: ${bleKey}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    bleKey: bleKey,
  });

  // No response should be sent back to the IoT lock for the K0 command response
}

// Function to handle the I0 response (obtain SIM ICCID number)
function handleSIMICCIDResponse(parts) {
  const deviceId = parts[2];
  const iccid = parts[5].split('#')[0];

  console.log(
    `SIM ICCID response (I0) received. Device ${deviceId}, ICCID: ${iccid}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    iccid: iccid,
  });

  // No response should be sent back to the IoT lock for the I0 command response
}

// Function to handle the M0 response (get Bluetooth MAC address)
function handleBluetoothMACResponse(parts) {
  const deviceId = parts[2];
  const macAddress = parts[5].split('#')[0];

  console.log(
    `Bluetooth MAC address response (M0) received. Device ID: ${deviceId}, MAC Address: ${macAddress}`
  );

  // Update Firestore
  updateFirestore(deviceId, {
    mac: macAddress,
  });

  // No response should be sent back to the IoT lock for the M0 command response
}

// Function to handle RFID card unlock request
function handleRfidCardUnlockRequest(parts) {
  const deviceId = parts[2];
  const action = parts[5];
  const adminBikedNumber = parts[7].split('#')[0];

  console.log(
    `RFID card unlock request received. Device ID: ${deviceId}, Action: ${action}, Biked Number: ${adminBikedNumber}`
  );

  // Predefined (test) biked number for validation
  const predefinedBikedNumber = '000000000CC4B5A4'; // TODO: Replace with the actual biked number to check

  // Check if the action is '0' (unlock request)
  if (action === '0') {
    // Check if the biked number matches the predefined biked number
    if (adminBikedNumber === predefinedBikedNumber) {
      // Construct the unlock command
      const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const commandContent = `0,${adminBikedNumber},${timestamp}`;
      const unlockCommand = createCommand(
        deviceId,
        CommandType.UNLOCK,
        commandContent
      );

      // Send the unlock command to the lock
      sendCommand(deviceId, unlockCommand);
      console.log(`Unlock command sent for biked number: ${adminBikedNumber}`);
    } else {
      console.log(
        `Biked number mismatch. Received: ${adminBikedNumber}, Expected: ${predefinedBikedNumber}`
      );
    }
  } else {
    console.log(`Action ${action} is not an unlock request. No command sent.`);
  }
}

// Function to handle the C1 response (RFID number management)
function handleRFIDManagementResponse(parts) {
  const deviceId = parts[2];
  const adminBikedNumber = parts[5].split('#')[0];

  console.log(
    `RFID management response received. Device ID: ${deviceId}, Admin biked number: ${adminBikedNumber}`
  );

  // No response should be sent back to the IoT lock for the C1 command response
}

// Express API endpoint to handle unlock requests
app.post('/unlock', async (req, res) => {
  const { deviceId, userId } = req.body;

  // Get the current timestamp accurate to the second range
  const timestamp = Math.floor(Date.now() / 1000);

  const commandContent = `0,${userId},${timestamp}`;
  const command = createCommand(deviceId, CommandType.UNLOCK, commandContent);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Unlock command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle positioning requests
app.post('/location', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.LOCATION);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Location command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle location tracking requests
app.post('/location-tracking', async (req, res) => {
  const { deviceId, interval } = req.body; // 'interval' is the upload location interval in seconds
  const commandContent = `${interval}`;
  const command = createCommand(
    deviceId,
    CommandType.LOCATION_TRACKING,
    commandContent
  );

  try {
    sendCommand(deviceId, command);
    res
      .status(200)
      .json({ message: 'Location tracking command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle access status requests
app.post('/status', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.STATUS);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Status command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle activate alarm requests
app.post('/activate-alarm', async (req, res) => {
  const { deviceId, ringTimes } = req.body;
  const commandContent = `${ringTimes},0`;
  const command = createCommand(
    deviceId,
    CommandType.ACTIVATE_ALARM,
    commandContent
  );

  try {
    sendCommand(deviceId, command);
    res
      .status(200)
      .json({ message: 'Activate alarm command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle firmware information requests
app.post('/firmware-info', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.FIRMWARE_INFO);

  try {
    sendCommand(deviceId, command);
    res
      .status(200)
      .json({ message: 'Firmware information request sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to initiate an upgrade
app.post('/start-upgrade', async (req, res) => {
  const {
    deviceId,
    upgradeDataPackage,
    dataLengthPerPackage,
    crc16,
    deviceTypeCode,
    upgradeKey,
  } = req.body;
  const commandContent = `${upgradeDataPackage},${dataLengthPerPackage},${crc16},${deviceTypeCode},${upgradeKey}`;
  const command = createCommand(
    deviceId,
    CommandType.UPGRADE_AVAILABLE,
    commandContent
  );

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Upgrade command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle BLE key requests
app.post('/ble-key', async (req, res) => {
  const { deviceId, action, bleKey } = req.body; // 'action' is 0 for read, 1 for set
  const commandContent = action === '0' ? '0,' : `1,${bleKey}`;
  const command = createCommand(deviceId, CommandType.BLE_KEY, commandContent);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'BLE key command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle SIM ICCID requests
app.post('/sim-iccid', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.SIM_ICCID);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'SIM ICCID command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle Bluetooth MAC address requests
app.post('/bluetooth-mac', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.BLUETOOTH_MAC);

  try {
    sendCommand(deviceId, command);
    res
      .status(200)
      .json({ message: 'Bluetooth MAC address command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle power off requests
// TODO: As this command is used for power off the device during transportation, we first need
// to make sure that the device is unlocked the before shutting down. To boot device, simply
// lock it manually or it will be booted up once put into charge.
app.post('/power-off', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.POWER_OFF);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Power off command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle reboot requests
app.post('/reboot', async (req, res) => {
  const { deviceId } = req.body;
  const command = createCommand(deviceId, CommandType.REBOOT);

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'Reboot command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle RFID unlock requests
app.post('/rfid-unlock', async (req, res) => {
  const { deviceId, bikeNumber } = req.body;
  const actionRequested = '0'; // 0 means unlock operation
  const retention = '0'; // Fill in 0
  const commandContent = `${actionRequested},${retention},${bikeNumber}`;
  const command = createCommand(
    deviceId,
    CommandType.RFID_UNLOCK,
    commandContent
  );

  try {
    sendCommand(deviceId, command);
    res.status(200).json({ message: 'RFID unlock command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express API endpoint to handle RFID management requests
app.post('/rfid-management', async (req, res) => {
  const { deviceId, operation, adminBikedNumber } = req.body;
  const commandContent = `${operation},${
    operation === '1' || operation === '2' ? '0' : adminBikedNumber
  }`;
  const command = createCommand(
    deviceId,
    CommandType.RFID_MANAGEMENT,
    commandContent
  );

  try {
    sendCommand(deviceId, command);
    res
      .status(200)
      .json({ message: 'RFID management command sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server on both the API port and the TCP port
server.listen(API_PORT, () => {
  console.log(`Express server running on port ${API_PORT}`);
});

tcpServer.listen(PORT, () => {
  console.log(`TCP server running on port ${PORT}`);
});
