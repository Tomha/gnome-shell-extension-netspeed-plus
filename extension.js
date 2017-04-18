const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;

// Settings
let interfaceTypes = ["eno", "enp", "wlp"];
let interval = 1;
let multiLine = true;
let precision = 2;

function NetSpeedExtension() {
    this._init();
}

NetSpeedExtension.prototype = {
    _formatSpeed: function (speed){
        try {
            let units = ["B", "K", "M", "G"];
            let index = 0;
            while (speed >= 1000){
                speed /= 1000;
                index += 1;
            }
            let int = speed | 0;
            let len = int.toString().length;
            let speedText;

            let pad = "     ";
            for (let i = 0; i < precision; i++) pad += " ";
            if (speed == int) speedText = (pad + speed.toString()).slice(len);
            else speedText = (pad + speed.toFixed(precision).toString()).slice(len + 3);

            return speedText + units[index];
        } catch (e) {
            return "FORMAT ERROR";  // For debug
        }
    },

    _getReceivedAndTransmitted: function () {
        try {
            let received = 0;
            let transmitted = 0;
            let inputFile = Gio.File.new_for_path('/proc/net/dev');
            let readStream = inputFile.read(null);
            let dataStream = Gio.DataInputStream.new(readStream);
            let line;
            while (line = dataStream.read_line(null)) {
                line = line.toString().trim();
                let columns = line.split(/\W+/);
                if (columns.length < 4) break;
                let heading = columns[0];
                let ifaceType = heading.substring(0, 3);
                if (interfaceTypes.indexOf(ifaceType) >= 0) {
                    received += parseInt(columns[1]);
                    transmitted += parseInt(columns[9]);
                }
            }
            readStream.close(null);
            return [received, transmitted];
        } catch (e) {
            return[0, 0];
        }
    },

    _init: function () {
        this.totalReceived = 0;
        this.totalTransmitted = 0;

        this.button = new St.Bin({ style_class: 'panel-button',
                              reactive: true,
                              can_focus: true,
                              x_fill: true,
                              y_fill: false,
                              track_hover: true });
        this.label = new St.Label({ style_class: 'netspeed-label', text: "init..." });
        this.button.set_child(this.label);

        this.loop = null;
    },

    _update: function () {
        try {
            let throughput = this._getReceivedAndTransmitted();
            let received = throughput[0];
            let transmitted = throughput[1];

            let justReceived = received - this.totalReceived;
            let justTransmitted = transmitted - this.totalTransmitted;

            this.totalReceived = received;
            this.totalTransmitted = transmitted;

            let text = "";
            text += this._formatSpeed(justReceived / interval) + "↓";
            if (multiLine) text += "\n";
            else text += " ";
            text += this._formatSpeed(justTransmitted / interval) + "↑";

            this.label.set_text(text);
        } catch (e) {
            this.label.set_text("UPDATE ERROR");  // For debug
        }
        return true;
    },

    enable: function () {
        let throughput = this._getReceivedAndTransmitted();
        this.totalReceived = throughput[0];
        this.totalTransmitted = throughput[1];
        Main.panel._rightBox.insert_child_at_index(this.button, 0);
        this.loop = Main.Mainloop.timeout_add_seconds(interval, Lang.bind(this, this._update));
        this.label.set_text("enable...");  // For debug
    },

    disable: function () {
        Main.Mainloop.source_remote(this.loop);
        Main.panel._rightBox.remove_child(this.button);
    }
};

function init() {
    return new NetSpeedExtension();
}
