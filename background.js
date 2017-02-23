const Ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');
const ProgressBar = require('progress');
const ffbinaries = require('ffbinaries');
const crypto = require('crypto');
const os = require('os');
const inquirer = require('inquirer');
const LocalStorage = require('node-localstorage');

const OUT_PATH = os.tmpdir();
const SAMPLE_SIZE = 100 * 1024;
const MIN_SIZE = 1024;
const VOB_CONTAINER = 'VIDEO_TS';

Promise.promisifyAll(fs);
Promise.promisifyAll(ffbinaries);

async function getMovieFiles (root) {
	const dvdPath = path.join(root, VOB_CONTAINER);
	const files = await fs.readdirAsync(dvdPath);
	const vobFiles = files
		.filter(name => !!name.toLowerCase().match(/.vob$/))
		.map(name => path.join(dvdPath, name));
	
	const stats = await Promise.map(vobFiles, async vobFile => {
		const stat = await fs.statAsync(vobFile);
		stat.path = vobFile;
		return stat;
	});

	return stats.filter(stat => stat.size > 1000 * MIN_SIZE);	
}

function mergeVideos (files, filename) {
	const bar = new ProgressBar('Converted [:bar] :percent :etas remaining', {
		complete: '#',
		incomplete: '=',
		width: 20,
		total: 100
	});
	let oldPercent = 0;
	const tr = Ffmpeg();
	files.forEach(file => {
		tr.addInput(file.path);
	});
	tr.format('mp4');
	tr.mergeToFile(filename, os.tmpdir());

	return new Promise(function (resolve, reject) {
		tr.on('progress', progress => {
			// console.log(progress);
		});
		tr.on('end', resolve);
		tr.on('error', reject);
	});
}

async function getHashName (files) {
	const hash = crypto.createHash('sha256');
	await Promise.each(files, async file => {
		const fd = await fs.openAsync(file.path, 'r');
		const buffer = Buffer.alloc(SAMPLE_SIZE * 1024);
		await fs.readAsync(fd, buffer, 0, SAMPLE_SIZE * 1024, 0);
		hash.update(buffer);
	});
	return hash.digest('hex');
}

async function handleDiskInserted (root) {
	console.log("Disk was inserted at", root);
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

	const {filename} = await inquirer.prompt({
		type: 'input',
		name: 'filename',
		message: 'Enter the intended name for the DVD'
  	});
	
	const directory = path.join(os.homedir(), 'Videos', 'JACK DVD RIPPER');
	console.log("Ripping files to disk, this may take a while");
	await fs.ensureDir(directory);
	mergeVideos(files, path.join(directory, `${filename}.mp4`));
}

async function downloadBinaries () {
	const ffbinariesDownloaded = fs.existsSync(`./ffbinaries/ffmpeg${os.platform() === 'win32'?'.exe':''}`);
	/* download ffmpeg binaries if not found */
	if (!ffbinariesDownloaded) {
		console.log("FFmpeg binaries not found, the app will now try to fetch these binaries, this is a 1 time installation.");
		await ffbinaries.downloadFilesAsync({
			destination: './ffbinaries',
			quiet: true
		});
		console.log("Binaries download complete.");
	}
}


async function main (args) {
	await downloadBinaries();

	const isWin32 = os.platform() === 'win32';
	const extn = isWin32?'.exe':'';

	Ffmpeg.setFfmpegPath(`./ffbinaries/ffmpeg${extn}`);
	Ffmpeg.setFfprobePath(`./ffbinaries/ffprobe${extn}`);
	Ffmpeg.setFlvtoolPath(`./ffbinaries/flvtool${extn}`);

	const command = args[2];
	switch(command) {
		case 'rip':
			const source = args[3];

			if(!source){
				return console.error('No source specified');
			} 
			handleDiskInserted(args[3]);
		break;
		case 'list':

		default:
			console.error("Unknonw command ", command, "valid commands are rip to rip a dvd to disk and list to show all the ripped dvd");
		break;
	}
}

main(process.argv);
