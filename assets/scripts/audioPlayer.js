/* 
    A javascript audio player that can play a playlist of audio files, with a custom UI 
    playlist, and download functionality. It supports live radio streams, scrubbing, 
    and keyboard controls. The player can be embedded in a webpage and is responsive 
    to screen size changes.

    This code was written a long time ago and probably needs updating... -_-
    - zy
*/

// setup elements
const playIcon = document.getElementById("playIcon");
const BGMText = document.getElementById("BGMName");
const playlistText = document.getElementById('playlistText');
const audioStatus = document.getElementById('audioStatus');
const audio = document.querySelector('audio');
let playState = 0;
let muteState = 0; // currently unused
let playerShownOnce = false; // to solve errors with slow loading
let playedOnce = false; // used to ignore various keys until a BGM is first played
var playKeyPressed = false;
var isLive = false;
var isLiveOnce = false;
var loaded = false;
let tick = -70; // sin wave of loading/live radio animation
let isLiveLoading = 0; // used for error checking of live loading and scrubbing
let liveLoadingCount = 0;
var originalTabTitle = document.title; // unused
let downloadingEnabled = false;
let downloadingAllEnabled = false;
let jsZipScriptLoaded = false;

// Load JSZip script once during initial page load
function loadJSZipScript() {
    return new Promise((resolve, reject) => {
        if (jsZipScriptLoaded) {
            resolve();
            return;
        }
        var script = document.createElement('script');
        script.onload = function () {
            jsZipScriptLoaded = true;
            resolve();
        };
        script.onerror = function () {
            reject(new Error('Failed to load JSZip script'));
        };
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        document.head.appendChild(script);

        console.debug(`%caudioplayer.js%c > %cJSZip script loaded`, "color:#fcce27", "color:#fff", "color:#ffefb5")
    });
}

//load metadata
audio.addEventListener('loadedmetadata', () => { // wait for data to load
    displayDuration(); // calculate audio duration in minutes:seconds (only applys for audio html and not rest of playlist)
    setTimeTexts(); // calculates currently elapsed audio in the same format and set the texts
    loadedMetadata("Loaded metadata");
});

function loadedMetadata(message) { // reset sin value
    console.debug(`%caudioplayer.js%c > %c${message}: ${audioName}`, "color:#fcce27", "color:#fff", "color:#ffefb5")
    loaded = true;
    tick = -70;
}

// mediasession API
function newMediaData() {
    let imagesrc = audioName.replaceAll('#', '%23') + ".png" // fallback
    if (playlistOriginal.length > 1) if (playlistOriginal[playlistNumPlaying].includes("|")) imagesrc = playlistOriginal[playlistNumPlaying].split("|")[1]; // if a custom album image is listed use it
    navigator.mediaSession.metadata = new MediaMetadata({
        title: audioName,
        artist: playListTitle,
        album: playListTitle,
        artwork: containsAlbumArt ? [{ src: path + imagesrc, type: "image/png" }] : [{ src: "assets/media/teamemblems/hres/DEFAULT.png", type: "image/png" }]
    });
}
navigator.mediaSession.setActionHandler('previoustrack', function () {
    if (playlistMode == 1) prevBGM();
});
navigator.mediaSession.setActionHandler('nexttrack', function () {
    if (playlistMode == 1) nextBGM();
});
// let defaultSkipTime = 10;
// navigator.mediaSession.setActionHandler('seekbackward', function(event) {
//   const skipTime = event.seekOffset || defaultSkipTime;
//   audio.currentTime = Math.max(audio.currentTime - skipTime, 0);
// });

// navigator.mediaSession.setActionHandler('seekforward', function(event) {
//   const skipTime = event.seekOffset || defaultSkipTime;
//   audio.currentTime = Math.min(audio.currentTime + skipTime, audio.duration);
// });
navigator.mediaSession.setActionHandler('play', async function () {
    await audio.play();
    playState = 1
    setPlayIcon()
});
navigator.mediaSession.setActionHandler('pause', function () {
    audio.pause();
    playState = 0
    setPlayIcon()
});
audio.addEventListener('play', function () {
    navigator.mediaSession.playbackState = 'playing';
    playState = 1
    setPlayIcon()
});
audio.addEventListener('pause', function () {
    navigator.mediaSession.playbackState = 'paused';
    playState = 0
    setPlayIcon()
});
navigator.mediaSession.setActionHandler('seekto', function (event) {
    if (event.fastSeek && ('fastSeek' in audio)) { // use fastseek in a browser if possible
        audio.fastSeek(event.seekTime);
        return;
    }
    audio.currentTime = event.seekTime;
});

//set BGM text and download link
var audioName = "Loading...";
setBGMText();
function setBGMText() {
    audioName = audio.src.split('/').reverse()[0]; // parse url and get clean audio name
    if (audioName.includes(".")) audioName = decodeURI(audioName.substring(0, audioName.lastIndexOf('.'))).replaceAll('%23', '#')
    if (audioName.length < 2) audioName = audio.src // if audio name results in a 0/1 length string (usually with web radios)

    sessionStorage.audioPlaying = audio.src
    // set html text for the currently playing audio
    BGMText.innerHTML = "♫ " + `<span id="BGMNameSelect">` + audioName + `</span>` + `${downloadingEnabled ? " | " + `<a href="${audio.src}" download target="_blank">Download</a>` : ""}`;
    setTabName();

    try {
        if (playlistMode == 1) { // setup html for playlists (the previous/next buttons, the music count / playlist count)
            let imagesrc = audioName.replaceAll('#', '%23') + ".png" // fallback
            if (playlistOriginal[playlistNumPlaying].includes("|")) imagesrc = playlistOriginal[playlistNumPlaying].split("|")[1]; // if a custom album image is listed use it
            playlistText.innerHTML = ""
            if (containsAlbumArt) playlistText.innerHTML = `<img class="albumArt" src="${path}${imagesrc}">`;
            playlistText.innerHTML += `<button onclick="prevBGM()"><<< Previous</button> <button class="blankButton" onclick="pickRandomTrack()"> ${playlistNumPlaying + 1} / ${playlistLength} </button> <button onclick="nextBGM()">Next >>></button> ${downloadingAllEnabled ? ' | <button onclick="downloadAllTracks()" id="downloadAllButton">Download All</button>' : ''}`;
        }
    }
    catch (error) {
        console.error(`%caudioplayer.js%c > %cPlaylist track text placeholder doesn't exist: ${error}`, "color:#fcce27", "color:#fff", "color:#ffefb5")
    }
}

function setTabName() {
    if (playedOnce) document.title = `${audioName}`; // change the tab title to the audio's name
}

//toggle pause if the play button is pressed again
function playAudio() {
    if (!playKeyPressed) togglePause(); // this is to fix tab usage 'focus' issues
};

window.addEventListener('keydown', function (event) {
    if (event.code == 'Space' && event.target == document.body) {
        event.preventDefault(); // prevent 'Space' scrolling the page
    }
});

// if the play icon is clicked, toggle pause
playIcon.addEventListener('click', () => {
    togglePause();
});

//change play icon
function togglePause() {
    playerShownOnce = true;
    if (loaded) playState = 1 - playState;
    else audio.play()
    sessionStorage.playState = playState;
    setPlayIcon();
    if (playState) {
        audio.play().then(_ => newMediaData()) //update the media session api
        playedOnce = true;
        handleAudioStatusPosition();
        setTabName();
        whilePlaying();
    } else {
        audio.pause();
    }
};

function setPlayIcon() {
    playIcon.src = `assets/media/audioplayer/play${playState}.avif`; // set the svg play icon
    if (audioStatus.className == "hidden") audioStatus.className = ""; // show the whole audio player if a pause happened (space pressed)
}

//audio playing and time calculations
var durationContainer = "0:00";
const currentTimeContainer = document.getElementById('currentTime');
const totalTimeContainer = document.getElementById('totalTime');
const audioBar = document.getElementById("audioProgressBar");
let multiplier = 1; // based on size of the screen (on low-width mode)
var mouseDown = false;
var scrubKeyArray = [false, false]; // used for calculating left/right key scrubbing speeds
var heldCount = 0;

timesAsLoadingIndicators();

audio.addEventListener('timeupdate', () => { // fired at browser discretion (anti-fingerprinting)
    if (loaded) {
        if (isLiveLoading == -1) {
            console.debug(`%caudioplayer.js%c > %cLive scrubbing done`, "color:#fcce27", "color:#fff", "color:#ffefb5")
            isLiveLoading = 0;
            liveLoadingCount = 0;
        }
        if (isLiveLoading > 0) isLiveLoading = -1;
        whilePlaying();
    }
    else {
        audioBar.style.borderLeft = 0 + "px solid #fa5252"; // values which wont cause javascript errors
        audioBar.style = "width: " + 200 * multiplier + "px";
        if (!playlistMode) {
            displayDuration();
            loadedMetadata("Loaded metadata (LATE)")
            audio.play() //this is getting hacky now
        }
    }
});

audio.addEventListener('ended', () => {
    playState = 0;
    setPlayIcon(); // pause song when over (if there is no playlist)
    if (playlistMode == 1) nextBGM(); // audiomatically play next BGM in playlist if there is one
})

const displayDuration = () => {
    duration = calculateTime(audio.duration); // calculate duration in minutes:seconds
};

const calculateTime = (secs) => { // convert seconds to minutes:seconds
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    const returnedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${minutes}:${returnedSeconds}`;
};

window.addEventListener('resize', () => { // correct audio bar sizes when resizing
    whilePlaying();
});

//update time and progress bar position
const whilePlaying = () => {
    try {
        multiplier = setMultiplier();
        setTimeTexts(); // sets time and width of playing bar
    } catch { // sometimes the browser bugs out and loads audio in a different order if using back/forward cache
        displayDuration();
        loadedMetadata("Loaded metadata (LATE)")
    }
};

function setMultiplier() {
    if (window.innerWidth <= 1000) {
        let safeAreaRight = 0;
        let safeAreaLeft = 0;
        
        // Try to get safe area values
        try {
            const style = getComputedStyle(document.documentElement);
            safeAreaRight = parseInt(style.getPropertyValue("--safe-area-inset-right") || 
                                   style.getPropertyValue("env(safe-area-inset-right)")) || 0;
            safeAreaLeft = parseInt(style.getPropertyValue("--safe-area-inset-left") || 
                                  style.getPropertyValue("env(safe-area-inset-left)")) || 0;
        } catch {
            // Fallback values if env() isn't supported
            safeAreaRight = 0;
            safeAreaLeft = 0;
        }
        
        return (document.documentElement.clientWidth - 200 - safeAreaRight - safeAreaLeft) / 200;
    } else {
        return 1.2;
    }
}

function setTimeTexts() {
    // if playing an internet-radio for instance
    if (!isFinite(audio.duration)) { //live player you can't scrub
        isLive = true;
        isLiveOnce = true;
        duration = "LIVE"; // just show "LIVE" instead of "0:00"
    } else { //live player you can scrub
        duration = calculateTime(audio.duration)
        isLive = false;
    }
    currentTimeContainer.textContent = calculateTime(audio.currentTime);
    totalTimeContainer.textContent = duration; // this is calculated when loading metadata
    if (!isLive) { // using styling to set audio duration bar width, this is CPU expensive, so don't use rapidly
        audioBar.style = "width: " + Math.ceil(200 * multiplier - ((audio.currentTime / audio.duration) * 200 * multiplier)) + "px";
        audioBar.style.borderLeft = Math.floor((audio.currentTime / audio.duration) * 200 * multiplier) + `px solid #fa5252`;
    }

    if (duration == "LIVE") sessionStorage.currentTime = "LIVE";
    else sessionStorage.currentTime = audio.currentTime;
}

//scrubbing and bar position
document.getElementById('audioProgressBar').addEventListener('mousedown', (event) => {
    mouseDown = true;
    positionBar(event, false);
});
document.getElementById('audioProgressBar').addEventListener('mousemove', (event) => {
    if (mouseDown) positionBar(event, false);
});
document.getElementById('audioProgressBar').addEventListener('touchmove', (event) => {
    positionBar(event, true)
});
document.addEventListener('mouseup', () => {
    mouseDown = false;
});

//position bar based on touch
function positionBar(event, isTouch) {
    if (!loaded) return; // dont do anything for unloaded audio
    if (isTouch) var posX = event.touches[0].clientX - event.target.getBoundingClientRect().left; //x position within the element.
    else var posX = event.clientX - event.target.getBoundingClientRect().left; //x position within the element.
    
    let seekingTime = (posX / 200 / multiplier) * audio.duration
        
    if (isLiveOnce) isLiveLoading = 1; // count ticks incase loading fails
    if ('fastSeek' in audio) {
        audio.fastSeek(seekingTime);
        return;
    }
    audio.currentTime = seekingTime; //set new audio time based of x position
    whilePlaying(); // recalculate position of duration bar
};

//check what keys are pressed or held
document.addEventListener('keydown', (event) => { // listen for pressed keys
    if (event.key == "ArrowLeft" || event.key == 'a') scrubKeyArray[0] = true; // prepare for scrubbing and hold key checks
    if (event.key == "ArrowRight" || event.key == 'd') scrubKeyArray[1] = true;
    if (event.code == "Space" || event.code == "Enter") playKeyPressed = true;
});

document.addEventListener('keyup', (event) => { // listen for released keys
    if (event.key == "ArrowLeft" || event.key == 'a') scrubKeyArray[0] = false;
    if (event.key == "ArrowRight" || event.key == 'd') scrubKeyArray[1] = false;
    if (event.code == "Space" || event.code == "Enter") {
        playKeyPressed = false;
        togglePause();
    }
});

//hold key scrubbing
const isTrue = (element) => element == true;
setInterval(function checkKeysDown() { // still more efficient and pleasing than using the actual javascript way of 'holding down key -> repeatedly fire input'
    if (playedOnce) {
        if (scrubKeyArray.some(isTrue)) { // keys that are held are stored in an array (two items - left key / right key)
            heldCount += 1;
            if (heldCount < 2 || heldCount > 40 && heldCount % 2 == 0 || heldCount > 150) { // initial skip, wait a second ... skip rapidly every '2' cycles, 
                // then after more time, increase the length of skips
                if (scrubKeyArray[0]) skipAudio(-5);
                if (scrubKeyArray[1]) skipAudio(5);
            }
        } else {
            heldCount = 0;
        }
    }
    if (!loaded && playedOnce) loadingAnimation();
    if (isLive) {
        loadingAnimation();
        if (isLiveLoading == -1) {
            liveLoadingCount++;
            if (liveLoadingCount > 450) {
                console.debug(`%caudioplayer.js%c > %cLive scrubbing taking too long - reloading audio`, "color:#fcce27", "color:#fff", "color:#ffefb5")
                reloadBGM();
                isLiveLoading = 0;
                liveLoadingCount = 0;
            }
        }
    }
    if (playlistKeyTimeOut > 0) playlistKeyTimeOut--; // for holding the next track button

}, 10); // repeat every 10ms

function skipAudio(skip) {
    audio.currentTime += skip;
    if (heldCount > 300) audio.currentTime += skip; // larger skip
}

async function loadingAnimation() { // provides information about loading and (the type of) layback of the audio
    tick = tick + 1; // used to calculate sin wave
    let sin = (Math.sin(tick / 40) + 1) * 0.5 // sin wave calculation
    let colourcode = 45 + Math.round(Math.sin(tick / 10) * 20); // cycle through red-ish colours
    if (isLive) { // make the bar full, indicating audio is playing and is live so current time can't be changed
        audioBar.style = "width: " + Math.ceil(200 * multiplier - (200 * multiplier)) + "px"; // adjust css styles to move scrubbing bar
        audioBar.style.borderLeft = Math.floor(200 * multiplier) + `px solid #fa${colourcode}52`;
    } else { // bar is moving in a sin wave (loading)
        audioBar.style = "width: " + Math.ceil(200 * multiplier - ((sin) * 200 * multiplier)) + "px";
        audioBar.style.borderLeft = Math.floor(sin * 200 * multiplier) + `px solid #fa${colourcode}52`
    }
    document.documentElement.style.setProperty('--audiohovercolour', `#fa${colourcode}52`); // set colour of hover glow
}

//playlist feature
var playlistMode = 0;
var playlist = [];
var playlistOriginal = [];
var playlistNumPlaying = 0; //code indexing, when rendered +1 is added
var playlistLength = 1;
var path;
var playListTitle = "";
var containsAlbumArt = false;
getPlaylist();

async function getPlaylist() {
    let playlistData = document.getElementById("audioStatus").dataset.playlist; //attempt to retrieve playlist file from audioStatus class data
    
    path = decodeURI(audio.src).substring(0, audio.src.lastIndexOf('/')) + "/" //remove %20's (and likewise) from link, get path without the audio filename (so what folder it'd be in)
    if (!playlistData) return; //if the playlist .txt file doesn't exist - terminate

    path + playlistData // make a full path to the playlist .txt file
    fetch(path + playlistData)
        .then((response) => response.ok ? response.text() : console.error(`%caudioplayer.js%c > %cPlaylist file doesn't exist!`, "color:#fcce27", "color:#fff", "color:#ffefb5"))
        .then((data) => setData(data)); // javascript fetching protocol
}

function insertPlaylistData(data) {
    path = ""
    playlist = data
    setPlaylistData()
}

async function setData(data) {
    if (data) {
        playlist = data.split(/\r?\n|\r|\n/g);
        setPlaylistData()
    }
}

async function setPlaylistData() {
    playListTitle = playlist[0].split("|")[0]; // the first item in the playlist .txt file will be information
    if (playlist[0].split("|")[1]) {
        if (playlist[0].split("|")[1].toLowerCase() == "true") {
            containsAlbumArt = true; // album art is named the same as the BGM name but with a different file extension (.png)
        }
    }
    if (playlist[0].split("|")[2]) {
        if (playlist[0].split("|")[2].toLowerCase() == "true") {
            downloadingEnabled = true; // whether downloading is enabled
        }
    }
    if (playlist[0].split("|")[3]) {
        if (playlist[0].split("|")[3].toLowerCase() == "true") {
            downloadingAllEnabled = true; // whether downloadingAll enabled
        }
    }
    playlist = playlist.slice(1); // remove the first item (playlist information has already been set)
        
    playlistOriginal = JSON.parse(JSON.stringify(playlist)) // original playlist with extra data
    for (let i = 0; i < playlist.length; i++) { // only keep audio.srcs in playlist
        playlist[i] = playlist[i].split("|")[0];
    }
    if (playlist.length > 0) {
        console.debug(`%caudioplayer.js%c > %cGot playlist`, "color:#fcce27", "color:#fff", "color:#ffefb5");
        isLive = false;
        isLiveOnce = false;
        document.getElementById("playlistText").className = "visible"; // show playlist HTML code
        playlistMode = 1;
        playlistLength = playlist.length;
        if (!playedOnce) audio.src = adjustAudioLink(0); // needed if the first item is a web radio link (nothing would play otherwise)
        else if (isValidHttpUrl(playlist[0]) && playlistNumPlaying == 0) { // already 'attempted' playing (but web link will not work so reload it)
            audio.src = adjustAudioLink(0);
            reloadBGM();
        }
        if (playerShownOnce) audio.play()
        setBGMText();
    }
    else {
        console.error(`%caudioplayer.js%c > %cPlaylist file is invalid`, "color:#fcce27", "color:#fff", "color:#ffefb5"); // an error in the playlist .txt file has occured
    }
}

let playlistKeyTimeOut = 0;
document.addEventListener('keydown', (event) => {
    if (playlistMode == 1 && playlistKeyTimeOut < 1) {
        if (event.key == "[") prevBGM();
        if (event.key == "]") nextBGM();
    }
})

function prevBGM() {
    playlistNumPlaying >= 1 ? playlistNumPlaying-- : playlistNumPlaying = playlistLength - 1; // wrap around
    startNewBGM();
}
function nextBGM() {
    playlistNumPlaying = (playlistNumPlaying + 1) % playlistLength; // wrap around
    startNewBGM();
}
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min)) + min; //javascript random number generator
function pickRandomTrack() {
    playlistNumPlaying = randomNumber(0, playlistLength)
    startNewBGM();
}

function isValidHttpUrl(string) { //check if an item in the playlist .txt file is an URL
    let url;
    try { url = new URL(string) } catch (_) { return false }
    return url.protocol === "http:" || url.protocol === "https:";
}

function adjustAudioLink(index) {
    if (isValidHttpUrl(playlist[index])) { //check if weblink
        return playlist[index]; // url link
    }
    else {
        isLiveOnce = false;
        newpath = path + playlist[index]; // 'audio file' with website url prefixed
        return newpath.replaceAll('#', '%23') // javascript dumb
    }
}

function resetAudioParameters() {
    playlistKeyTimeOut = 5; // holding playlist key time gap
    playedOnce = true;
    loaded = false;
    tick = -70; //reset sin wave
}

function timesAsLoadingIndicators() {
    currentTimeContainer.textContent = ". . ." // loading indicators for 0:00 / 0:00 ...
    totalTimeContainer.textContent = ". . .";
}

function startPlayingAudio() {
    audio.play().then(_ => newMediaData()) // update the media session api as well as play audio
    setBGMText(); // set audio current time and duration (as well as tab title)
    playState = 1; // unpause
    setPlayIcon(); // set pause icon
}

function startNewBGM() {
    resetAudioParameters();
    isLive = false;
    isLiveOnce = false;
    audio.src = adjustAudioLink(playlistNumPlaying)
    audio.currentTime = 0;
    timesAsLoadingIndicators();

    audioBar.style.borderLeft = 0 + "px solid #fa5252"; // reset colours
    document.documentElement.style.setProperty('--audiohovercolour', '#fa5252');
    multiplier = setMultiplier(); // set "multiplier" as to not see the adjustment of the bar width
    audioBar.style = "width: " + 200 * multiplier + "px";
    startPlayingAudio();
}

function startSpecificBGM(BGM) { // for buttons that can be placed around the page that play a specific BGM from the playlist .txt file
    if (playlistMode) {
        if (BGM.substring(0, BGM.lastIndexOf('.')) == audioName && playedOnce) { // if the button of the audio already playing is clicked, pause the audio
            togglePause();
            return;
        }
        if (playlist.includes(BGM)) { // find BGM from index and play it
            playlistNumPlaying = playlist.findIndex(element => element == BGM);
            startNewBGM();
        }
    }
    else {
        console.debug(`%caudioplayer.js%c > %cPlaylist mode isn't active!`, "color:#fcce27", "color:#fff", "color:#ffefb5")
        if (audioName == BGM) { // error checking
            startNewBGM();
            console.debug(`%caudioplayer.js%c > %cPlayed anyways: despite the error (wrong function set)`, "color:#fcce27", "color:#fff", "color:#ffefb5")
        }
    }
}

function reloadBGM() { // used if live audio breaks itself
    resetAudioParameters();
    audio.src = audio.src; // reload currently playing audio
    startPlayingAudio();
}

let currentlyDownloadingAllTracks = false;

function downloadAllTracks() {
    if (currentlyDownloadingAllTracks) return;
    document.getElementById('downloadAllButton').innerHTML = `Downloading...`;
    currentlyDownloadingAllTracks = true;

    loadJSZipScript().then(() => {
        zipTracksToDownload();
    }).catch(error => {
        console.error(`%caudioplayer.js%c > %c${error}`, "color:#fcce27", "color:#fff", "color:#ffefb5")
        currentlyDownloadingAllTracks = false;
        document.getElementById('downloadAllButton').innerHTML = `Download All`;
    });
}

async function zipTracksToDownload() {
    const zip = new JSZip();
    let completedDownloads = 0; // Track actual completed downloads
    
    // Update progress function that uses the actual count
    function updateProgress() {
        const percent = Math.ceil(completedDownloads / playlist.length * 100);
        document.getElementById('downloadAllButton').innerHTML = `Downloading... ${percent}%`;
        if (completedDownloads >= playlist.length) {
            document.getElementById('downloadAllButton').innerHTML = "Compressing...";
        }
    }

    const promises = playlist.map((url, index) => {
        const filename = decodeURI(url.substring(url.lastIndexOf('/') + 1).replace(/\?.*/, ''));

        return fetch((path + url).replaceAll('#', '%23'))
            .then(response => {
                if (response.ok) {
                    return response.blob().then(blob => {
                        zip.file(filename, blob);
                        completedDownloads++; // Increment when a file is actually added
                        updateProgress();
                    });
                } else {
                    console.error(`%caudioplayer.js%c > %cFailed to fetch ${url}`, "color:#fcce27", "color:#fff", "color:#ffefb5");
                    completedDownloads++; // Still count as completed (even if failed)
                    updateProgress();
                }
            })
            .catch(error => {
                console.error(`%caudioplayer.js%c > %cError fetching ${url}: ${error}`, "color:#fcce27", "color:#fff", "color:#ffefb5");
                completedDownloads++; // Still count as completed (even if error)
                updateProgress();
            });
    });

    try {
        await Promise.all(promises);

        const content = await zip.generateAsync({ type: 'blob' });
        const zipBlob = new Blob([content], { type: 'application/zip' });
        const zipUrl = URL.createObjectURL(zipBlob);

        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${playListTitle}.zip`;
        link.click();

        document.getElementById('downloadAllButton').innerHTML = `Download All`;
        URL.revokeObjectURL(zipUrl);
        currentlyDownloadingAllTracks = false;
    } catch (error) {
        console.error(`%caudioplayer.js%c > %c${error}`, "color:#fcce27", "color:#fff", "color:#ffefb5");
        currentlyDownloadingAllTracks = false;
        document.getElementById('downloadAllButton').innerHTML = `Download All`;
    }
}

function handleAudioStatusPosition() {
	const audioStatus = document.getElementById('audioStatus');
	const main = document.querySelector('main');
	const footer = document.querySelector('footer');

	if (!audioStatus || !main || !footer) return;

	const isMobile = window.innerWidth <= 1000;

	if (!isMobile) {
		audioStatus.style.position = '';
		audioStatus.style.bottom = '';
		main.style.paddingBottom = '';
		return;
	}

	if (typeof playedOnce !== 'undefined' && playedOnce) {
		main.style.paddingBottom = '125px';
	} else {
		main.style.paddingBottom = '';
	}

    const footerRect = footer.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    if (footerRect.top < windowHeight) {
        audioStatus.style.bottom = `${windowHeight - footerRect.top + 25}px`;
    } else {
        audioStatus.style.bottom = '25px';
    }
}

// Attach listeners
window.addEventListener('scroll', handleAudioStatusPosition);
window.addEventListener('resize', handleAudioStatusPosition);
document.addEventListener('DOMContentLoaded', handleAudioStatusPosition);