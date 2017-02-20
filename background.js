const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const ffbinaries = require('ffbinaries');
const winDrives = require('win-eject');
const crypto = require('crypto');
const os = require('os');
const {Tray, Menu, app, BrowserWindow} = require('electron'); 

const SAMPLE_SIZE = 100 * 1024;
const MIN_SIZE = 1024;
const TEMP_SPACE_NAMESPACE = 'NODE_RIPPER'; 

Promise.promisifyAll(fs);
Promise.promisifyAll(ffbinaries);

async function getMovieFiles (drive) {
	const files = await fs.readdirAsync(path);
	const vobFiles = files
		.filter(name => !!name.toLowerCase().match(/.vob$/))
		.map(name => path.join(DVD_PATH, name));
	
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
	const tr = ffmpeg();
	files.forEach(file => {
		tr.mergeAdd(file.path);
		tr.mergeAdd(TRANSITION_SCREEN);
	});
	tr.format('mp4');
	tr.output(path.join(OUT_PATH, filename));
	tr.run();
	return new Promise(function (resolve, reject) {
		tr.on('stderr', err => console.error(err));
		tr.on('progress', progress => {
			console.log(progress);
		});
		tr.on('end', resolve);
		tr.on('error', reject);
	});
}

async function convert (drive, filename, childWindow) {
	const merger = await mergeVideos(files, filename, childWindow);
}

async function getHashName (files) {
	const hash = crypto.createHash('sha256');
	await Promise.forEach(files, async file => {
		const fd = await fs.openAsync(file.path, 'r');
		const buffer = Buffer.alloc(SAMPLE_SIZE * 1024);
		const data = await fs.readAsync(fd, buffer, 0, SAMPLE_SIZE * 1024);
		hash.update(buffer);
	});
	return hash.digest('hex');
}

async function handleDiskInserted () {
	const files  = await getMovieFiles(drive);
	if (files.length < 1) {
		return;
	}

	const hashed = await getHashName(files);
	const directoryName = path.join(os.tmpdir(), TEMP_SPACE_NAMESPACE, hashed);
	
	if (fs.existsSync(directoryName)) {
		return;
	}
	/* Show prompt to import */
}


async function downloadBinaries () {
	const ffbinariesDownloaded = fs.existsSync('./ffbinaries/ffmpeg');
	/* download ffmpeg binaries if not found */
	if (!ffbinariesDownloaded) {
		const browserWindow = new BrowserWindow({
			center: true,
			movable: false,
			skipTaskbar: true,
			useContentSize: true,
			width: 480,
			height: 240
		});
		browserWindow.loadURL(`file:///${process.cwd()}/screens/install.html`);
		browserWindow.setProgressBar(14, "indeterminate");
		await ffbinaries.downloadFilesAsync({
			destination: './ffbinaries'
		});
		browserWindow.destroy();
	}
}

async function main () {
	const tray = new Tray('./vendor/dvd.png');
	await downloadBinaries();
	/* Set a watcher (on windows only), this will allow us to popup almost immediately, because windows */
	if ( os.platform() === 'win32' ) {
		const drives = await listDrives();
		return drives.forEach(drive => {
			const watcher = fs.watch(path.join(drive + 'VIDEO_TS'));
			watcher.on('rename', e => handleDiskInserted(drive));
		});
	}
}

app.on('ready', main);