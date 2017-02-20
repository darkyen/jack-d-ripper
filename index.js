const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const ProgressBar = require('progress');
const readlineSync = require('readline-sync');
const DVD_PATH = 'D:\\VIDEO_TS';
const TRANSITION_SCREEN = './vendor/videos/transition.mp4';
const OUT_PATH = 'C:\\Users\\toby\\Videos\\Ripped';
const MIN_SIZE = 1024;

Promise.promisifyAll(fs);

async function getMovieFiles (file) {
	const files = await fs.readdirAsync(DVD_PATH);
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
			bar.tick(progress.percent - oldPercent);
			oldPercent = progress.percent;
		});
		tr.on('end', resolve);
		tr.on('error', reject);
	});
}

async function main () {
	console.log("Starting to rip");
	const filename = `${readlineSync.question('What do you want the file name to be? \n\n')}.mp4`;
	
	const files  = await getMovieFiles();
	const merger = await mergeVideos(files, filename);
	console.log("Merged");
}

main();