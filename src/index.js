import {
  RFIDReader,
  TMR_REGION_NORTHAMERICA,
  TMR_TAG_PROTOCOL_GEN2,
} from "./lib/RFIDReader.js";

import Debug from "debug";

const debug = Debug("rfid");

const rfidReader = new RFIDReader({
  path: "COM10",
  baudRate: 115200,
  autoOpen: false,
});

const tags = {};

rfidReader.on("open", async () => {
  debug("port opened");
  await rfidReader.stopReading(); // stop the reader (in case someone left it running)...
  await rfidReader.getVersion();
  await rfidReader.setRegion(TMR_REGION_NORTHAMERICA);
  await rfidReader.setReadPower(20.05); // dBm
  await rfidReader.setTagProtocol(TMR_TAG_PROTOCOL_GEN2);
  await rfidReader.setAntennaPort();

  rfidReader.startReading((tag) => {
    debug("Tag", tag);
    const epc = tag.epc.toString("HEX");
    if (tags[epc]) {
      tags[epc] = tags[epc] + 1;
    } else {
      tags[epc] = 1;
    }
    console.log(tag.epc.toString("HEX") + " " + tags[epc]);
  });
});

rfidReader.open((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  await rfidReader.stopReading();
  rfidReader.flush();
  console.log("done.");
  process.exit();
});
