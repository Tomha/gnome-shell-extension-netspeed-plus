const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;

var label, button;
var loop;

var total_received, total_transmitted;

// Settings
var interval = 1;
var multi_line = true;
var precision = 2;
var interface_types = ["eno", "enp", "wlp"];

function format_speed(speed){
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
		return "ERROR"
	}
}

function update() {
	try {
		let throughput = get_received_and_transmitted();
		let received = throughput[0];
		let transmitted = throughput[1];

		let just_received = received - total_received;
		let just_transmitted = transmitted - total_transmitted;

		total_received = received;
		total_transmitted = transmitted;

		let text = "";
		text += format_speed(just_received / interval) + "↓";
		if (multi_line) text += "\n";
		else text += " ";
		text += format_speed(just_transmitted / interval) + "↑";

		label.set_text(text);
	} catch (e) {
		label.set_text("ERROR");
	}
	return true;
}

function get_received_and_transmitted() {
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

}

function init() {
	button = new St.Bin({ style_class: 'panel-button',
			              reactive: true,
			              can_focus: true,
			              x_fill: true,
			              y_fill: false,
			              track_hover: true });
	label = new St.Label({ style_class: "netspeed-label", text: "init..." });
	button.set_child(label);
}

function enable() {
	let throughput = get_received_and_transmitted();
	total_received = throughput[0];
	total_transmitted = throughput[1];
	Main.panel._rightBox.insert_child_at_index(button, 0);
	loop = Main.Mainloop.timeout_add_seconds(interval, update);
	label.set_text("enable...");
}

function disable() {
	Main.Mainloop.source_remote(loop);
	Main.panel._rightBox.remove_child(button);
}
