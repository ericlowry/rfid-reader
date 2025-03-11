import { program } from 'commander';

import {
  RFIDReader,
  TMR_REGION_NORTHAMERICA,
  TMR_TAG_PROTOCOL_GEN2,
} from './lib/RFIDReader.js';

import pkg from '../package.json' with { type: "json" };

import Debug from 'debug';

const debug = Debug('rfid');

const getString = (v) => v;
const getInteger = (i) => parseInt(i);
const getNumber = (n) => Number(n);

program
  .name('rfid-reader')
  .version(pkg.version)
  .option(
    '-d --ttyDevice <dev>',
    'device name [/dev/ttyUSB0]',
    getString,
    '/dev/ttyUSB0'
  )
  .option('-b --baudRate <baud>', 'baud rate [115200]', getInteger, 115200)
  .option('-o --txPower <dBm>', 'transmit power in dBm [5.05]', getNumber, 5.05)
  .option('-i --rxPower <dBm>', 'receive power in dBm [5.05]', getNumber, 5.05)
  .parse(process.argv);

const opts = program.opts();

debug('opts', program.opts());

const rfidReader = new RFIDReader({
  path: opts.ttyDevice,
  baudRate: opts.baudRate,
  autoOpen: false,
});

const tags = {};

rfidReader.on('open', async () => {
  debug('port opened');
  await rfidReader.stopReading(); // stop the reader (in case someone left it running)...
  await rfidReader.getVersion();
  await rfidReader.setRegion(TMR_REGION_NORTHAMERICA);
  await rfidReader.setReadPower(opts.rxPower); // dBm
  await rfidReader.setWritePower(opts.txPower); // dBm
  await rfidReader.setTagProtocol(TMR_TAG_PROTOCOL_GEN2);
  await rfidReader.setAntennaPort();

  rfidReader.startReading(tag => {
    debug('Tag', tag);
    const epc = tag.epc.toString('HEX');
    if (tags[epc]) {
      tags[epc] = tags[epc] + 1;
    } else {
      tags[epc] = 1;
    }
    console.log(tag.epc.toString('HEX') + ' ' + tags[epc]);
  });
});

rfidReader.open(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('exiting');
  rfidReader.stopReading();
  setTimeout(() => {
    console.log('done.');
    process.exit();
  }, 750);
});
