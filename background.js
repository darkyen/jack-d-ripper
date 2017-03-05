const HBjs = require('handbrake-js');
const fs = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');
const ProgressBar = require('progress');
const crypto = require('crypto');
const os = require('os');
const inquirer = require('inquirer');
const LocalStorage = require('node-localstorage');
const winDrive = require('win-eject');
const nixDrive = require('diskdrive');
const notifier = require('node-notifier');

let getHasher = null;

try{
	getHasher = (function(){
		const XXHash = require('xxhash');
		return function (){
			if (os.arch().indexOf('64') !== -1) {
				return new XXHash.XXHash64(0xACDCDCAC);
			}
			return new XXHash(0xACDCDCAC);
		}
	})();
}catch(e){
	console.info("XXHash not supported on platform, falling back to MD5");
	getHasher = (function (){
		const crypto = require('crypto');
		return function getMD5Hash() {
			return crypto.createHash('md5');
		}
	})();
}


const OUT_PATH = os.tmpdir();
const SAMPLE_SIZE = 100 * 1024;
const MIN_SIZE = 1024;
const VOB_CONTAINER = 'VIDEO_TS';

const isWin32 = os.platform() === 'win32';
const driveUtil = isWin32 ? winDrive : nixDrive;

Promise.promisifyAll(driveUtil);
Promise.promisifyAll(fs);

async function getMovieFiles (normalizedVobPath) {
	const files = await fs.readdirAsync(normalizedVobPath);
	const vobFiles = files
		.filter(name => !!name.toLowerCase().match(/.vob$/))
		.map(name => path.join(normalizedVobPath, name));
	
	const stats = await Promise.map(vobFiles, async vobFile => {
		const stat = await fs.statAsync(vobFile);
		stat.path = vobFile;
		return stat;
	});

	return stats.filter(
		stat => stat.size > 1000 * MIN_SIZE
	);	
}

function countTitles (root) {
	// Count tracks on disk http://superuser.com/questions/394516/how-to-convert-50-episodes-from-dvd-into-50-mp4-with-handbrake-easily
	return new Promise(function (resolve, reject) {
		HBjs.exec({
			input: root,
			title: 0
		}, function (err, stdout, stderr) {
			if (err) {
				return reject(err);
			}
			/* Now then */
			// count=$(echo $rawout | grep -Eao "\\+ title [0-9]+:" | wc -l)
			const matches = stderr.match(/\+ title [0-9]+/gi);
			resolve(matches.length);
		});
	})
}

function convertTitleToVideo (root, title, outFile) {
	const progressBar = new ProgressBar(`Converting Title ${title} [:bar] :percent :etas remaining`, {
		complete: '#',
		incomplete: '=',
		width: 20,
		total: 100
	});


	return new Promise((resolve, reject) => {
		let oldProgress = 0;

		const hb = HBjs.spawn({
			output: outFile,
			input: root,
			title
		});

		hb.on('error', reject);
		hb.on('end', resolve);
		hb.on('progress', function (p) {
			progressBar.tick(p.percentComplete - oldProgress);
			oldProgress = p.percentComplete;
		});
	});
}

async function getHashName (files) {
	const hash = getHasher();
	await Promise.each(files, async file => {
		const fd = await fs.openAsync(file.path, 'r');
		const buffer = Buffer.alloc(SAMPLE_SIZE * 1024);
		await fs.readAsync(fd, buffer, 0, SAMPLE_SIZE * 1024, 0);
		hash.update(buffer);
	});
	return hash.digest('hex');
}

/* Scanning of files happens in fs, dvds are ripped through handbrake */
async function handleDiskInserted (root, supressNotification=false) {
	const files  = await getMovieFiles(root);

	if (files.length < 1) {
		return;
	}

	console.log("Hashing files to check if already imported");
	const hashed = await getHashName(files);
	
	if (false) {
		console.log('Disk was already imported, bailing out');
		return;
	}

	if (supressNotification !== true) {
		notifier.notify({
			title: 'DVD Detected',
			message: `A new dvd was detected on ${root}. Please click this notification to know more.`
		});
	}

	const {dvdName} = await inquirer.prompt({
		type: 'input',
		name: 'dvdName',
		message: 'Enter the intended name for the DVD'
  	});
	
	const fullDirectoryPath = path.join(os.homedir(), 'Videos', 'JACK DVD RIPPER', dvdName);
	console.log("Ripping files to disk, this may take a while");
	await fs.ensureDir(fullDirectoryPath);
	const titleLen = await countTitles(root);
	for ( let title = 1; title <= titleLen ; title++ ) {
		await convertTitleToVideo(root, title, path.join(fullDirectoryPath, `Title #${title}.mp4`));
	}
}

async function getDrives(){
	return isWin32 ? await driveUtil.drivesAsync() : (await inquirer.prompt({
		message: 'Please enter a comma seperated list of drives you want to monitor (Ex: /dev/dvd,/foo-bar)',
		type: 'input',
		name: 'paths',
	})).paths.split(',');
}

async function runCLI() {
	/* If windows then we will monitor all drives, if its ??nix we will ask */

	const drives = await getDrives();
	
	for (let drive of drives) {

		const normalizedVobPath = path.join(
			drive.replace('~', os.homedir()), 
			VOB_CONTAINER
		);
		
		if (fs.existsSync(normalizedVobPath)) {
			await handleDiskInserted(normalizedVobPath, true);
			await driveUtil.ejectAsync();
		}
		
		fs.watch(normalizedVobPath, async (eName, fileName) => {
			if (eName === 'rename') {
				try {
					await handleDiskInserted(normalizedVobPath);
					await driveUtil.ejectAsync();
				} catch (e) {
					console.log("Error while ripping the dvd, process will exit now");
					process.exit(-1);
				}
			}
		});

	}

	console.log('Now watching for dvds', drives.join(','));
}


async function main (args) {
	const command = args[2];
	switch(command) {
		case 'rip':
			const source = args[3];

			if(!source){
				return console.error('No source specified');
			} 
			await handleDiskInserted(args[3], true);

		break;

		default:
			/* Run as a cli-service */
			runCLI();
		break;
	}
}

main(process.argv);
