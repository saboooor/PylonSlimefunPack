import * as unzipper from 'unzipper';
import archiver from 'archiver';
import * as fs from 'fs';
import packageJSON from './package.json';

const pylonZip = 'pylon-resource-pack/output/PylonPack.zip';
const pylonPackPath = './PylonPack';
const slimefunPackPath = './Slimefun';
const mergedPackPath = './PylonSlimefun';

// Unzip the pylon pack into the PylonPack folder
const directory = await unzipper.Open.file(pylonZip);
await directory.extract({ path: pylonPackPath });
console.log('Unzipped pylon pack');

// Copy all files from SlimefunPackPath to MergedPackPath 
fs.cpSync(slimefunPackPath, mergedPackPath, { recursive: true });
console.log('Copied slimefun pack to merged pack');

// Copy all files from PylonPackPath to MergedPackPath/pylon_untouched
fs.cpSync(pylonPackPath, `${mergedPackPath}/pylon_untouched`, { recursive: true });
console.log('Copied pylon pack to merged pack');

// Merge the mcmeta files
const slimefunMcmeta = JSON.parse(fs.readFileSync(`${slimefunPackPath}/pack.mcmeta`, 'utf-8'));
const pylonMcmeta = JSON.parse(fs.readFileSync(`${pylonPackPath}/pack.mcmeta`, 'utf-8'));
const mergedMcmeta = {
  pack: {
    ...slimefunMcmeta.pack,
    description: [
      'Pylon + Slimefun Pack',
      `${pylonMcmeta.pack.description[1]} + ${packageJSON.version}`,
    ]
  },
  overlays: {
    entries: [
      ...slimefunMcmeta.overlays?.entries,
      // PylonPack Overlay
      {
        directory: "pylon_untouched",
        formats: {
          min_inclusive: 55,
          max_inclusive: 999
        },
        min_format: 55,
        max_format: 999
      },
      {
        directory: "pylon_slimefun_merge",
        formats: {
          min_inclusive: 55,
          max_inclusive: 999
        },
        min_format: 55,
        max_format: 999
      }
    ]
  },
  Credits: {
    ...slimefunMcmeta.Credits,
    ...pylonMcmeta.Credits,
    'Sab': 'https://github.com/saboooor'
  }
};
fs.writeFileSync(`${mergedPackPath}/pack.mcmeta`, JSON.stringify(mergedMcmeta, null, 2));
console.log('Merged pack.mcmeta');

// copy pack.png from root to merged pack
fs.copyFileSync(`./pack.png`, `${mergedPackPath}/pack.png`);
console.log('Copied ./pack.png to merged pack');

// go through all the files in pylon pack item assets and merge them
const pylonItemsPath = `${pylonPackPath}/assets/minecraft/items`;
const slimefunItemsPath = `${slimefunPackPath}/assets/minecraft/items`;
const slimefun1216ItemsPath = `${slimefunPackPath}/overlay_1_21_6_plus/assets/minecraft/items`;
const mergedItemsPath = `${mergedPackPath}/pylon_slimefun_merge/assets/minecraft/items`;

// create mergedItemsPath folder in merged pack
fs.mkdirSync(mergedItemsPath, { recursive: true });

fs.readdirSync(pylonItemsPath).forEach(file => {
  const pylonFilePath = `${pylonItemsPath}/${file}`;
  const slimefunFilePath = `${slimefunItemsPath}/${file}`;
  const slimefun1216FilePath = `${slimefun1216ItemsPath}/${file}`;

  // if the file does not exist in either slimefun folder, skip it
  if (!fs.existsSync(slimefun1216FilePath) && !fs.existsSync(slimefunFilePath)) return;

  const pylonFile = JSON.parse(fs.readFileSync(pylonFilePath, 'utf-8'));
  const slimefunFile = fs.existsSync(slimefun1216FilePath)
    ? JSON.parse(fs.readFileSync(slimefun1216FilePath, 'utf-8'))
    : JSON.parse(fs.readFileSync(slimefunFilePath, 'utf-8'));
  
  // in case there is a fallback in the pylon file, move it to the slimefun file and set the pylon fallback to the slimefun file
  const oldFallback = pylonFile.model.fallback;
  slimefunFile.model.fallback = oldFallback;

  const mergedFile = {
    ...slimefunFile,
    ...pylonFile,
    model: {
      ...pylonFile.model,
      fallback: slimefunFile.model
    }
  }

  fs.writeFileSync(`${mergedItemsPath}/${file}`, JSON.stringify(mergedFile, null, 2));

  console.log(`Merged ${file}`);
});

console.log('Merged all item models');

// zip merged pack
const output = fs.createWriteStream('PylonSlimefun.zip');
const archive = archiver('zip', { zlib: { level: 9 }});

// listen for all archive data to be written
// 'close' event is fired only when a file descriptor is involved
output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('Merged pack has been zipped at PylonSlimefun.zip');
});

// This event is fired when the data source is drained no matter what was the data source.
// It is not part of this library but rather from the NodeJS Stream API.
// @see: https://nodejs.org/api/stream.html#stream_event_end
output.on('end', function() {
  console.log('Data has been drained');
});

// good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    // log warning
  } else {
    // throw error
    throw err;
  }
});

// good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});

// pipe archive data to the file
archive.pipe(output);

// append merged pack to the archive
archive.directory(mergedPackPath, false);

// finalize the archive
await archive.finalize();