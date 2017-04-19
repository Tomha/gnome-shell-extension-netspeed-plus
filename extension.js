/*Copyright (C) 2017 Tom Hartill

extension.js - Part of the NetSpeed Gnome Shell Extension.

NetSpeed is free software; you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation; either version 3 of the License, or (at your option) any later
version.

NetSpeed is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
AppChooser; if not, see http://www.gnu.org/licenses/.

An up to date version can be found at:
https://github.com/Tomha/gnome-shell-extension-netspeed */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Lang = imports.lang;
const Main = imports.ui.main;

// TODO: Implement interface filtering by name not type.
// TODO: Implement statistics per-interface not aggregate.
// TODO: Implement speed (and usage?) graph on left-click.
// TODO: Implement settings storage and loading.
// TODO: Implement prefs menu to change settings.
// TODO: Implement persistent usage statistics.

// Settings
const interfaces = ['eno1', 'enp13s0', 'wlp12s0b1'];
const interval = 1;
const vertical = false;
const precision = 2;

const showDn = true;
const showUp = true;
const showSum = true;
const showUsage = true;

const dnChar = "↓";
const upChar = "↑";
const sumChar = "⇵";
const usageChar = "Σ";

const dnColour = null;
const upColour = null;
const sumColour = null;
const usageColour = null;

const labelFamily = null;
const labelSize = null;

function NetSpeedExtension() {
    this._init();
}

NetSpeedExtension.prototype = {
    _formatStyle: function(colour, width, family, size) {
        let styleText = '';
        if (!!colour) styleText += ('color:' + colour + ';');
        if (!!width) styleText += ('width:' + width + ';');
        if (!!family) styleText += ('font-family:' + family + ';');
        if (!!size) styleText += ('font-size:' + size + ';')
        styleText += 'text-align:right;';
        return styleText;
    },

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

            if (speed == int) speedText = (speed.toString());
            else speedText = (speed.toFixed(precision).toString());

            return speedText + units[index];
        } catch (e) {
            return "FORMAT ERROR";  // For debug
        }
    },

    _getThroughput: function () {
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
                let interfaceName = columns[0];
                if (interfaces.indexOf(interfaceName) >= 0) {
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
        this._isRunning = false;

        this._totalReceived = 0;
        this._totalTransmitted = 0;

        this._labelBox = new St.BoxLayout({vertical: vertical});
        this._button = new St.Bin({style_class: 'panel-button',
                                   reactive: true,
                                   can_focus: true,
                                   x_fill: true,
                                   y_fill: false,
                                   track_hover: true,
                                   child: this._labelBox});

        // Try to find digit width of font:
        let tempLabel = new St.Label({style: this._formatStyle(null, null,
                                                               labelFamily,
                                                               labelSize)});
        let labelContext = tempLabel.create_pango_context();
        let labelContextMetrics = labelContext.get_metrics(null, null);
        let digitWidthUnits = labelContextMetrics.get_approximate_digit_width();
        this._digitWidth = digitWidthUnits / 1024;
        this._labelWidth = (6 + precision) * this._digitWidth;
        this._labelWidthString = this._labelWidth.toString() + "px";
        // More work than I would have liked, if only Gnome CSS had ch units :(

        let dnLabelStyle = this._formatStyle(dnColour, this._labelWidthString, labelFamily, labelSize);
        let upLabelStyle = this._formatStyle(upColour, this._labelWidthString, labelFamily, labelSize);
        let sumLabelStyle = this._formatStyle(sumColour, this._labelWidthString, labelFamily, labelSize);
        let usageLabelStyle = this._formatStyle(usageColour, this._labelWidthString, labelFamily, labelSize);

        this._dnLabel = new St.Label({style: dnLabelStyle});
        this._labelBox.add_child(this._dnLabel);
        this._dnLabel.hide();

        this._upLabel = new St.Label({style: upLabelStyle});
        this._labelBox.add_child(this._upLabel);
        this._upLabel.hide();

        this._sumLabel = new St.Label({style: sumLabelStyle});
        this._labelBox.add_child(this._sumLabel);
        this._sumLabel.hide();

        this._usageLabel = new St.Label({style: usageLabelStyle});
        this._labelBox.add_child(this._usageLabel);
        this._usageLabel.hide();

        this._button.connect('button-press-event',
                             Lang.bind(this, this._onButtonClicked));
    },

    _onButtonClicked: function (button, event) {
        if (event.get_button() == 3) {  // Right click button clears the couter
            this._initialReceived = this._totalReceived;
            this._initialTransmitted = this._totalTransmitted;
            this._usageLabel.set_text(this._formatSpeed(0) + usageChar);
        }
    },

    _update: function () {
        try {
            let throughput = this._getThroughput();
            let received = throughput[0];
            let transmitted = throughput[1];

            let justReceived = received - this._totalReceived;
            let justTransmitted = transmitted - this._totalTransmitted;

            this._totalReceived = received;
            this._totalTransmitted = transmitted;

            this._dnLabel.set_text(this._formatSpeed(justReceived / interval) + dnChar);
            this._upLabel.set_text(this._formatSpeed(justTransmitted / interval) + upChar);
            this._sumLabel.set_text(this._formatSpeed((justReceived + justTransmitted) / interval) + sumChar);
            this._usageLabel.set_text(this._formatSpeed(received - this._initialReceived + transmitted - this._initialTransmitted) + usageChar);
        } catch (e) {
            this._dnLabel.set_text("UPDATE ERROR");  // For debug
        }
        return this._isRunning;
    },

    enable: function () {
        this._isRunning = true;

        if (showDn) this._dnLabel.show();
        if (showUp) this._upLabel.show();
        if (showSum) this._sumLabel.show();
        if (showUsage) this._usageLabel.show();

        let throughput = this._getThroughput();
        this._totalReceived = throughput[0];
        this._initialReceived = throughput[0];
        this._totalTransmitted = throughput[1];
        this._initialTransmitted = throughput[1];

        Main.panel._rightBox.insert_child_at_index(this._button, 0);
        Main.Mainloop.timeout_add_seconds(interval,
                                          Lang.bind(this, this._update));
    },

    disable: function () {
        this._isRunning = false
        Main.panel._rightBox.remove_child(this._button);
    }
};

function init() {
    return new NetSpeedExtension();
}
