import { program } from "commander";

const getString = (v) => v;
const getInteger = (i) => parseInt(i);
const getNumber = (n) => Number(n);

program
  .name("rfid-util")
  .version("0.0.1")
  .option(
    "-d --ttyDevice <dev>",
    "device name [/dev/ttyUSB0]",
    getString,
    "/dev/ttyUSB0"
  )
  .option("-b --baudRate <baud>", "baud rate [115200]", getInteger, 115200)
  .option("-o --txPower <dBm>", "transmit power in dBm [5.05]", getNumber, 5.05)
  .option("-i --rxPower <dBm>", "receive power in dBm [5.05]", getNumber, 5.05)
  .parse(process.argv);

console.log(program.opts());
