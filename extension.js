const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;

// Settings
let interface_types = ["eno", "enp", "wlp"];
let interval = 1;
let multi_line = true;
let precision = 2;

const NetSpeedExtension = new Lang.Class({
    Name: 'NetSpeedExtension',

	_format_speed: function (speed){
		try {
			let units = ["B", "K", "M", "G"];
			let index = 0;
			while (speed >= 1000){
				speed /= 1000;
				index += 1;
			}
			let int = speed | 0;
			let len = int.toString().length;
			let speed_text;

			let pad = "     ";
			for (let i = 0; i < precision; i++) pad += " ";
			if (speed == int) speed_text = (pad + speed.toString()).slice(len);
			else speed_text = (pad + speed.toFixed(precision).toString()).slice(len + 3);

			return speed_text + units[index];
		} catch (e) {
			return "FORMAT ERROR"  // For debug
		}
	},

	_get_received_and_transmitted: function () {
		try {
			let received = 0;
			let transmitted = 0;
			let input_file = Gio.File.new_for_path('/proc/net/dev');
			let read_stream = input_file.read(null);
			let data_stream = Gio.DataInputStream.new(read_stream);
			let line;
			while (line = data_stream.read_line(null)) {
				line = line.toString().trim();
				let columns = line.split(/\W+/);
				if (columns.length < 4) break;
				let heading = columns[0];
				let iface_type = heading.substring(0, 3)
				if (interface_types.indexOf(iface_type) >= 0) {
					received += parseInt(columns[1]);
					transmitted += parseInt(columns[9]);
				}
			}
			read_stream.close(null);
			return [received, transmitted];
		} catch (e) {
			return[0, 0];
		}
	},

	_init: function () {
		this.total_received = 0;
		this.total_transmitted = 0;

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
			let throughput = this._get_received_and_transmitted();
			let received = throughput[0];
			let transmitted = throughput[1];

			let just_received = received - this.total_received;
			let just_transmitted = transmitted - this.total_transmitted;

			this.total_received = received;
			this.total_transmitted = transmitted;

			let text = "";
			text += this._format_speed(just_received / interval) + "↓";
			if (multi_line) text += "\n";
			else text += " ";
			text += this._format_speed(just_transmitted / interval) + "↑";

			this.label.set_text(text);
		} catch (e) {
			this.label.set_text("UPDATE ERROR");  // For debug
		}
		return true;
	},

	enable: function () {
		let throughput = this._get_received_and_transmitted();
		this.total_received = throughput[0];
		this.total_transmitted = throughput[1];
		Main.panel._rightBox.insert_child_at_index(this.button, 0);
		this.loop = Main.Mainloop.timeout_add_seconds(interval, Lang.bind(this, this._update));
		this.label.set_text("enable...");  // For debug
	},

	disable: function () {
		Main.Mainloop.source_remote(this.loop);
		Main.panel._rightBox.remove_child(this.button);
	}
});

function init() {
	return new NetSpeedExtension();
}
