import { SerialPort } from "serialport";
import { PacketLengthParser } from "@serialport/parser-packet-length";

import Debug from "debug";

const debug = Debug("rfid");

// Device OP Codes (Not a complete list)
// export const TMR_SR_OPCODE_KEEP_ALIVE = 0x00;
export const TMR_SR_OPCODE_VERSION = 0x03;
export const TMR_SR_OPCODE_SET_BAUD_RATE = 0x06;
export const TMR_SR_OPCODE_READ_TAG_ID_SINGLE = 0x21;
export const TMR_SR_OPCODE_READ_TAG_ID_MULTIPLE = 0x22;
export const TMR_SR_OPCODE_WRITE_TAG_ID = 0x23;
export const TMR_SR_OPCODE_WRITE_TAG_DATA = 0x24;
export const TMR_SR_OPCODE_KILL_TAG = 0x26;
export const TMR_SR_OPCODE_READ_TAG_DATA = 0x28;
export const TMR_SR_OPCODE_CLEAR_TAG_ID_BUFFER = 0x2a;
export const TMR_SR_OPCODE_MULTI_PROTOCOL_TAG_OP = 0x2f;
export const TMR_SR_OPCODE_GET_READ_TX_POWER = 0x62;
export const TMR_SR_OPCODE_GET_WRITE_TX_POWER = 0x64;
export const TMR_SR_OPCODE_GET_USER_GPIO_INPUTS = 0x66;
export const TMR_SR_OPCODE_GET_POWER_MODE = 0x68;
export const TMR_SR_OPCODE_GET_READER_OPTIONAL_PARAMS = 0x6a;
export const TMR_SR_OPCODE_GET_PROTOCOL_PARAM = 0x6b;
export const TMR_SR_OPCODE_SET_ANTENNA_PORT = 0x91;
export const TMR_SR_OPCODE_SET_TAG_PROTOCOL = 0x93;
export const TMR_SR_OPCODE_SET_READ_TX_POWER = 0x92;
export const TMR_SR_OPCODE_SET_WRITE_TX_POWER = 0x94;
export const TMR_SR_OPCODE_SET_USER_GPIO_OUTPUTS = 0x96;
export const TMR_SR_OPCODE_SET_REGION = 0x97;
export const TMR_SR_OPCODE_SET_READER_OPTIONAL_PARAMS = 0x9a;
export const TMR_SR_OPCODE_SET_PROTOCOL_PARAM = 0x9b;

//Define the allowed regions - these set the internal freq of the module
export const TMR_REGION_NORTHAMERICA = 0x01;
export const TMR_REGION_INDIA = 0x04;
export const TMR_REGION_JAPAN = 0x05;
export const TMR_REGION_CHINA = 0x06;
export const TMR_REGION_EUROPE = 0x08;
export const TMR_REGION_KOREA = 0x09;
export const TMR_REGION_AUSTRALIA = 0x0b;
export const TMR_REGION_NEWZEALAND = 0x0c;
export const TMR_REGION_NORTHAMERICA2 = 0x0d;
export const TMR_REGION_NORTHAMERICA3 = 0x0e;
export const TMR_REGION_OPEN = 0xff;

export const TMR_TAG_PROTOCOL_NONE = 0x00;
export const TMR_TAG_PROTOCOL_ISO180006B = 0x03;
export const TMR_TAG_PROTOCOL_GEN2 = 0x05;
export const TMR_TAG_PROTOCOL_ISO180006B_UCODE = 0x06;
export const TMR_TAG_PROTOCOL_IPX64 = 0x07;
export const TMR_TAG_PROTOCOL_IPX256 = 0x08;
export const TMR_TAG_PROTOCOL_ATA = 0x1d;

const OPCODE_NAMES = {
  0x00: "KEEP_ALIVE",
  0x03: "VERSION",
  0x06: "SET_BAUD_RATE",
  0x21: "READ_TAG_ID_SINGLE",
  0x22: "READ_TAG_ID_MULTIPLE",
  0x23: "WRITE_TAG_ID",
  0x24: "WRITE_TAG_DATA",
  0x26: "KILL_TAG",
  0x28: "READ_TAG_DATA",
  0x2a: "CLEAR_TAG_ID_BUFFER",
  0x2f: "MULTI_PROTOCOL_TAG_OP",
  0x62: "GET_READ_TX_POWER",
  0x64: "GET_WRITE_TX_POWER",
  0x66: "GET_USER_GPIO_INPUTS",
  0x68: "GET_POWER_MODE",
  0x6a: "GET_READER_OPTIONAL_PARAMS",
  0x6b: "GET_PROTOCOL_PARAM",
  0x91: "SET_ANTENNA_PORT",
  0x92: "SET_READ_TX_POWER",
  0x93: "SET_TAG_PROTOCOL",
  0x94: "SET_WRITE_TX_POWER",
  0x96: "SET_USER_GPIO_OUTPUTS",
  0x97: "SET_REGION",
  0x9a: "SET_READER_OPTIONAL_PARAMS",
  0x9b: "SET_PROTOCOL_PARAM",
};

export function debugTX(buff) {
  debug(">>", OPCODE_NAMES[buff[2]], buff);
}

export function debugRX(buff) {
  debug("<<", OPCODE_NAMES[buff[2]], buff);
}

function calculateCRC(buff, offset, length) {
  const crctable = [
    0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108,
    0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
  ];
  let crc = 0xffff;
  for (let i = 0; i < length; i++) {
    crc =
      (((crc << 4) | (buff[offset + i] >> 4)) ^ crctable[crc >> 12]) & 0xffff;
    // debug(`crc ${i}: 1 `, message[i], crc.toString(16), crc);
    crc =
      (((crc << 4) | (buff[offset + i] & 0x0f)) ^ crctable[crc >> 12]) & 0xffff;
    // debug(`crc ${i}: 2 `, message[i], crc.toString(16), crc);
  }
  return crc;
}

export function checkResponse(buff) {
  if (buff[0] !== 0xff) throw new Error("bad delimiter");
  const payloadLength = buff[1];
  if (buff.length != payloadLength + 7)
    throw new Error("buffer length mismatch");
  const crc1 = calculateCRC(buff, 1, payloadLength + 4);
  const crc2 = buff.readUInt16BE(buff.length - 2);
  if (crc1 !== crc2) throw new Error("crc failure");
}

//
// VERSION Command with NO payload
// <Buffer ff 00 03 1d 0c>
//          0  1  2  3  4
//
// SET_REGION Command with 1 byte payload
// <Buffer ff 01 97 01 4b bc>
//          0  1  2  3  4  5
//
function makeCommand(opCode, payload) {
  //debug("opCode:", OPCODE_NAMES[opCode], opCode.toString(16));
  //debug("payload:", payload);
  const payloadLength = payload ? payload.length : 0;
  const cmdLength = payloadLength + 5;
  const cmd = Buffer.alloc(cmdLength);
  cmd[0] = 0xff; // command delimiter
  cmd[1] = payload ? payload.length : 0; // number of bytes in payload
  cmd[2] = opCode;
  if (payload) {
    payload.copy(cmd, 3);
  }
  const crc = calculateCRC(cmd, 1, payloadLength + 2);
  cmd[cmdLength - 2] = crc >> 8;
  cmd[cmdLength - 1] = crc & 0xff;
  return cmd;
}

// extract tag information from a response packet
function tagInfo(data) {
  const rssi = data.readUint8(12);
  const dataBytes = Math.ceil(data.readUInt16BE(24) / 8);
  const epcBytes = Math.ceil(data.readUInt16BE(27) / 8);
  const epc = Buffer.copyBytesFrom(data, 31 + dataBytes, epcBytes - 4);
  return {
    rssi,
    epc,
  };
}

export class RFIDReader extends SerialPort {
  // VERSION Response Packet
  // <Buffer ff 14 03 00 00 23 01 06 00 38 00 02 01 20 24 09 13 02 01 06 08 00 00 00 10 cb 65>
  //          0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 27
  //
  parser = new PacketLengthParser({
    delimiter: 0xff,
    lengthOffset: 1,
    lengthBytes: 1,
    packetOverhead: 7, // delimiter + length + opCode + status(2) + crc(2)
    maxLen: 255,
  });

  constructor(options) {
    super(options);
    const port = this;
    port.pipe(this.parser);
  }

  //
  // sendAndWait() - send a command and wait for the reponse
  // returns a promise that resolves to the response packet
  //
  async sendAndWait(cmd) {
    const port = this;
    return new Promise((resolve, reject) => {
      this.parser.once("data", (data) => {
        checkResponse(data);
        debugRX(data);
        resolve(data);
      });
      debugTX(cmd);
      port.write(cmd);
    });
  }

  getVersion() {
    const cmd = makeCommand(TMR_SR_OPCODE_VERSION);
    return this.sendAndWait(cmd);
  }

  setRegion(region) {
    const cmd = makeCommand(TMR_SR_OPCODE_SET_REGION, Buffer.from([region]));
    return this.sendAndWait(cmd);
  }

  setReadPower(dBm) {
    let power = Math.abs(Math.trunc(dBm * 100));
    if (power > 2700) power = 2700;
    const cmd = makeCommand(
      TMR_SR_OPCODE_SET_READ_TX_POWER,
      Buffer.from([power >> 8, power & 0xff])
    );
    return this.sendAndWait(cmd);
  }

  getReadPower() {
    const cmd = makeCommand(TMR_SR_OPCODE_GET_READ_TX_POWER);
    return this.sendAndWait(cmd).then((result) => {
      const power = result.readUInt16BE(5);
      const dBm = power / 100;
      return dBm;
    });
  }

  setWritePower(dBm) {
    let power = Math.abs(Math.trunc(dBm * 100));
    if (power > 2700) power = 2700;
    const cmd = makeCommand(
      TMR_SR_OPCODE_SET_WRITE_TX_POWER,
      Buffer.from([power >> 8, power & 0xff])
    );
    return this.sendAndWait(cmd);
  }

  getWritePower() {
    const cmd = makeCommand(TMR_SR_OPCODE_GET_WRITE_TX_POWER);
    return this.sendAndWait(cmd).then((result) => {
      const power = result.readUInt16BE(5);
      const dBm = power / 100;
      return dBm;
    });
  }

  setTagProtocol(protocol) {
    const cmd = makeCommand(
      TMR_SR_OPCODE_SET_TAG_PROTOCOL,
      Buffer.from([0x00, protocol])
    );
    return this.sendAndWait(cmd);
  }

  // module only has 1 port, so tx and rx on the only port 0x01
  setAntennaPort(txPort = 0x01, rxPort = 0x01) {
    const cmd = makeCommand(
      TMR_SR_OPCODE_SET_ANTENNA_PORT,
      Buffer.from([txPort, rxPort])
    );
    return this.sendAndWait(cmd);
  }

  async stopReading() {
    const payload = Buffer.from([0x00, 0x00, 0x02]);
    const cmd = makeCommand(TMR_SR_OPCODE_MULTI_PROTOCOL_TAG_OP, payload);
    await this.sendAndWait(cmd);
  }

  startReading(onTag) {
    const port = this;

    const payload = Buffer.from([
      0x00, // Timeout (2)
      0x00,
      0x01, // 0x01 = Continous Read Mode
      0x22, // Sub-Command opCode: 0x22 = TMR_SR_OPCODE_READ_TAG_ID_MULTIPLE
      0x00, // Search Flags (2)
      0x00,
      0x05, // Protocol ID 0x05 = TMR_TAG_PROTOCOL_GEN2
      0x07, // ???
      0x22,
      0x10,
      0x00,
      0x1b,
      0x03,
      0xe8,
      0x01,
      0xff,
    ]);

    const cmd = makeCommand(TMR_SR_OPCODE_MULTI_PROTOCOL_TAG_OP, payload);
    debugTX(cmd);

    port.parser.on("data", (data) => {
      checkResponse(data);

      const opCode = data[2];

      if (opCode === TMR_SR_OPCODE_MULTI_PROTOCOL_TAG_OP) {
        debug("<<< IGNORE OPCODE", data);
        return;
      }

      if (opCode !== TMR_SR_OPCODE_READ_TAG_ID_MULTIPLE) {
        debug("<<< IGNORE UNEXPECTED", data);
        return;
      }

      const status = data.readUInt16BE(3);

      if (status === 0x0400) {
        debug("<<< IGNORE KEEP ALIVE", data);
        return;
      }

      if (status !== 0x0000) {
        debug("<<< IGNORE STATUS", data);
        return;
      }

      if (data[1] === 8) {
        debug("<<< IGNORE TAG COUNT", data);
        return;
      }

      debug("<<< TAG", data);
      const tag = tagInfo(data);

      // call the user's onTag callback function
      onTag(tag);
    });

    // start reading tags...
    port.write(cmd);
  }
}
