// LyraFlex_Controller.js
// Logic for handling AI-generated signals inside Mixxx

var LyraFlex = {};

LyraFlex.init = function(id, debugging) {
    print("LyraFlex Broadcast Link: ONLINE");
    print("Listening for Virtual MIDI signals from Chrome...");
};

LyraFlex.shutdown = function() {
    print("LyraFlex Broadcast Link: OFFLINE");
};

// Example of a custom script handler if we needed more complex logic 
// for the filter (though standard binding works for simple 1:1)
LyraFlex.incomingData = function(channel, control, value, status, group) {
    // This function can handle incoming raw data if <script-binding/> is used
    // print("Received MIDI: " + value);
};