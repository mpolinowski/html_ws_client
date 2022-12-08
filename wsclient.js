
var ws_protocol = document.getElementById("protocol");
var ws_hostname = document.getElementById("hostname");
var ws_port     = document.getElementById("port");
var ws_endpoint = document.getElementById("endpoint");
var codec_mime = document.getElementById("codecmime");
var cam_username = document.getElementById("username");
var cam_password = document.getElementById("password");

var queue = [];
var video = null;
var webSocket   = null;
var sourceBuffer = null;
var streamingStarted = false;

// Display ws pre-connected state
var statusBadge = document.getElementById("status");
const idle = `<h4><span class="badge bg-primary">WS Client</span></h4>`
statusBadge.innerHTML = idle;

// Init the Media Source and add event listener
function initMediaSource() {
    video = document.querySelector('video');
    video.onerror = elementError;
    video.loop = false;
    video.addEventListener('canplay', (event) => {
        console.log('Video can start, but not sure it will play through.');
        video.play();
    });
    video.addEventListener('paused', (event) => {
        console.log('Video paused for buffering...');
        setTimeout(function() { video.play(); }, 2000);
    });
    
    /* NOTE: Chrome will not play the video if audio is defined here
    * and the stream does not include audio */
    // var mimeCodec = 'video/mp4; codecs="avc1.4D001E, mp4a.40.2"';
    // var mimeCodec = 'video/mp4; codecs="avc1.4D001E"';
    // var mimeCodec = 'video/mp4; codecs="hev1.2.4.L120.B0, mp4a.40.2"';
    // var mimeCodec = 'video/mp4; codecs="hev1.2.4.L120.B0"';

    if (codec_mime.value = 0) {
            var mimeCodec = 'video/mp4; codecs="avc1.4D001E, mp4a.40.2"';
        } else if (codec_mime.value = 1) {
            var mimeCodec = 'video/mp4; codecs="avc1.4D001E"';
        } else if (codec_mime.value = 2) {
            var mimeCodec = 'video/mp4; codecs="hev1.2.4.L120.B0, mp4a.40.2"';
        } else {
            var mimeCodec = 'video/mp4; codecs="hev1.2.4.L120.B0"';
    }

    if (!window.MediaSource) {
        console.error("No Media Source API available");
        document.getElementById("incomingMsgOutput").value += "error: No Media Source API available" + "\r\n";
        return;
    }
    
    if (!MediaSource.isTypeSupported(mimeCodec)) {
        console.error("Unsupported MIME type or codec: " + mimeCodec);
        document.getElementById("incomingMsgOutput").value += "error: Unsupported MIME type or codec" + "\r\n";
        return;
    }
    
    var ms = new MediaSource();
    video.src = window.URL.createObjectURL(ms);
    ms.addEventListener('sourceopen', onMediaSourceOpen);
    
    function onMediaSourceOpen() {
        sourceBuffer = ms.addSourceBuffer(mimeCodec);
        sourceBuffer.addEventListener("updateend",loadPacket);
        sourceBuffer.addEventListener("onerror", sourceError);
    }
    
    function loadPacket() { // called when sourceBuffer is ready for more
        if (!sourceBuffer.updating) {
            if (queue.length>0) {
                data = queue.shift(); // pop from the beginning
                appendToBuffer(data);
            } else { // the queue runs empty, so we must force-feed the next packet
                streamingStarted = false;
            }
        }
        else {}
    }
    
    function sourceError(event) {
        console.log("Media source error");
    }
    
    function elementError(event) {
        console.log("Media element error");
    }
}

// Append AV data to source buffer
function appendToBuffer(videoChunk) {
    if (videoChunk) {
        sourceBuffer.appendBuffer(videoChunk);
    }
}

// Event handler for clicking on button "Connect"
function onConnectClick() {
     // Makes sure that user typed username and message before sending
     if ((ws_protocol.value === '') || (ws_hostname.value === '') || (ws_port.value === '') || (ws_endpoint.value === '') ||(cam_username === '') || (cam_password === '')) {
        errorToast("Please fill out all the configuration fields above!");
        return false;
    } else {
        initMediaSource();
        document.getElementById("incomingMsgOutput").value = "";
        document.getElementById("btnConnect").disabled    = true;
        openWSConnection(cam_username.value, cam_password.value, ws_protocol.value, ws_hostname.value, ws_port.value, ws_endpoint.value);
        successToast("Send the 'Start' message to start the video stream.");
        }    
}

// Event handler for clicking on button "Disconnect"
function onDisconnectClick() {
    document.getElementById("btnDisconnect").disabled = true;
    webSocket.close();
    video.pause();
}

// Adding confirmations with notie.js
function successToast(msg) {
    notie.alert({
        type: 'success', // optional, default = 4, enum: [1, 2, 3, 4, 5, 'success', 'warning', 'error', 'info', 'neutral']
        text: msg,
        stay: false, // optional, default = false
        time: 3, // optional, default = 3, minimum = 1,
        position: 'bottom' // optional, default = 'top', enum: ['top', 'bottom']
    })
}

//Adding alerts with notie.js
function errorToast(msg) {
    notie.alert({
        type: 'error', // optional, default = 4, enum: [1, 2, 3, 4, 5, 'success', 'warning', 'error', 'info', 'neutral']
        text: msg,
        stay: false, // optional, default = false
        time: 3, // optional, default = 3, minimum = 1,
        position: 'bottom' // optional, default = 'top', enum: ['top', 'bottom']
    })
}

// Open a new WebSocket connection using the given parameters
function openWSConnection(username, password, protocol, hostname, port, endpoint) {
    
    var webSocketURL = null;
    var keepAliveCount = 0;
    
    webSocketURL = protocol + "://" + username + ":" + password + "@" + hostname + ":" + port + endpoint;
    console.log("openWSConnection::Connecting to: " + webSocketURL);

    const offline = `<h4><span class="badge bg-danger">Disconnected</span></h4>`
    const online = `<h4><span class="badge bg-success">Connected</span></h4>`
    
    let statusBadge = document.getElementById("status");

    try {
        // webSocket = new WebSocket(webSocketURL);
        webSocket = new ReconnectingWebSocket(webSocketURL);
        webSocket.debug = true;
        webSocket.timeoutInterval = 3000;
        webSocket.onopen = function(openEvent) {
            var open = JSON.stringify(openEvent, null, 4);
            console.log("WebSocket open");
            document.getElementById("btnSend").disabled       = false;
            document.getElementById("btnConnect").disabled    = true;
            document.getElementById("btnDisconnect").disabled = false;
            document.getElementById("incomingMsgOutput").value += "WebSocket connected" + "\r\n";
            statusBadge.innerHTML = online
        };
        webSocket.onclose = function (closeEvent) {
            var closed = JSON.stringify(closeEvent, null, 4);
            console.log("WebSocket closed");
            document.getElementById("btnSend").disabled       = true;
            document.getElementById("btnConnect").disabled    = false;
            document.getElementById("btnDisconnect").disabled = true;
            document.getElementById("incomingMsgOutput").value += "WebSocket closed" + "\r\n";
            statusBadge.innerHTML = offline
        };
        webSocket.onerror = function (errorEvent) {
            var error = JSON.stringify(errorEvent, null, 4);
            console.log("WebSocket ERROR: " + error);
            document.getElementById("btnConnect").disabled    = false;
            document.getElementById("incomingMsgOutput").value += "error: Websocket connection failed" + "\r\n";
            statusBadge.innerHTML = offline
        };
        webSocket.onmessage = function (messageEvent) {
            var wsMsg = messageEvent.data;
            if (typeof wsMsg === 'string') {
            	if (wsMsg.indexOf("error:") == 0) {
                	document.getElementById("incomingMsgOutput").value += wsMsg + "\r\n";
            	} else {
                	document.getElementById("incomingMsgOutput").value += "echo message: " + wsMsg + "\r\n";
            	}
            } else {
                var arrayBuffer;
                var fileReader = new FileReader();
                fileReader.onload = function(event) {
                    arrayBuffer = event.target.result;
                    var data = new Uint8Array(arrayBuffer);
                    document.getElementById("incomingMsgOutput").value += "received: " + data.length + " bytes\r\n";
                    if (!streamingStarted) {
                        appendToBuffer(arrayBuffer);
                        streamingStarted=true;
                        return;
                    }
                    queue.push(arrayBuffer); // add to the end
                };
                fileReader.readAsArrayBuffer(wsMsg);
                /* NOTE: the web server has a idle-timeout of 60 seconds,
                 so we need to send a keep-alive message regulary */
                keepAliveCount++;
                if (keepAliveCount >= 10 && webSocket.readyState == WebSocket.OPEN) {
                    keepAliveCount = 0;
                    webSocket.send("keep-alive");
                }
            }
        };
    } catch (exception) {
        console.error(exception);
    }
}

// Send a message to the WebSocket server
function onSendClick() {
    if (webSocket.readyState != WebSocket.OPEN) {
        console.error("webSocket is not open: " + webSocket.readyState);
        return;
    }
    var msg = document.getElementById("wsmessage").value;
    webSocket.send(msg);
}