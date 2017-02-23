# Jack DVD Ripper
A simple dvd ripper tool, I wanted to help a neighbour move a ton of dvd's while handbrake etc are fun to use they are kinda stupendous
when you want to move like 300 dvds. So, well I thought how awesome would it be if I can copy paste the .vob first and then transcode it
for many many hours in a bulk. And thats exactly what Jack D Ripper does, it creates a busffer area in `/tmp/` and then transcodes them 
at a later time.

### What it does?
- Jack DVD Ripper is a tray tool, it will sit in your tray waiting for the ~~commies~~ dvds to be inserted.
- Once an old style dvd is inserted you can select ripper in the autoplay options or just choose the dvd drive in ripper.
- Ripper will then scan the dvd search if it already imported the disk (in its buffer).
- Once the copy is complete it will eject the disk out and offer you to either transcode now or add another disk.
- If you select transcode now it will transcode the disk to /User/Videos/Ripper

### Installation, nah.
Well I thought about doing a full blown squirrel backed electron port but then found git to be the best vendor tool, so if you want to install 
it just git-clone the repo, it will auto-update. 

### How does it work?

It uses a bunch of npm modules to work, electron provides the back-bone. ffmpeg provides the transcoder. Thanks to all the respective authors

### Supported platforms
Electron supported platforms.