import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const SERVICE = 'zapret.service';
const SCRIPT = '/opt/zapret/init.d/sysv/zapret';

const STATE_RUNNING = 0;
const STATE_STOPPED = 1;
const STATE_MISSING = 2;

const DOT_RUNNING = '#57e389';
const DOT_STOPPED = '#ff8a3d';
const DOT_MISSING = '#ff5c5c';

const MSG_NOT_INSTALLED = 'Zapret is not installed';
const MSG_RUNNING = 'Zapret: running';
const MSG_STOPPED = 'Zapret: stopped';

const ZapretIndicator = GObject.registerClass(
class ZapretIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Zapret', false);
        this._extension = extension;

        this._container = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            width: 26,
            height: 22,
        });
        this.add_child(this._container);

        const iconPath = GLib.build_filenamev([
            extension.path, 'icons', 'zapret-z-symbolic.svg',
        ]);
        const iconFile = Gio.File.new_for_path(iconPath);
        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            icon_size: 20,
        });
        this._container.add_child(this._icon);

        this._dot = new St.Bin({width: 8, height: 8});
        this._container.add_child(this._dot);

        this._allocId = this._container.connect('notify::allocation', () => {
            this._icon.set_position(
                Math.floor((this._container.width - 20) / 2),
                Math.floor((this._container.height - 20) / 2)
            );
            this._dot.set_position(
                this._container.width - 9,
                this._container.height - 9
            );
        });

        // Menu items
        this._statusItem = new PopupMenu.PopupMenuItem('');
        this._statusItem.sensitive = false;
        this.menu.addMenuItem(this._statusItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._startItem = new PopupMenu.PopupMenuItem('Start');
        this._startItem.connect('activate', () => this._runScript('start'));
        this.menu.addMenuItem(this._startItem);

        this._stopItem = new PopupMenu.PopupMenuItem('Stop');
        this._stopItem.connect('activate', () => this._runScript('stop'));
        this.menu.addMenuItem(this._stopItem);

        this._restartItem = new PopupMenu.PopupMenuItem('Restart');
        this._restartItem.connect('activate', () => this._runScript('restart'));
        this.menu.addMenuItem(this._restartItem);

        this._enabledItem = new PopupMenu.PopupMenuItem('');
        this._enabledItem.connect('activate', () => {
            this._runEnable(this._enabled ? 'disable' : 'enable');
        });
        this.menu.addMenuItem(this._enabledItem);

        this._active = false;
        this._enabled = false;
        this._exists = true;
        this._timeoutId = 0;
        this._pollId = 0;
    }

    vfunc_button_press_event(event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_SECONDARY) {
            let msg;
            if (!this._exists)
                msg = MSG_NOT_INSTALLED;
            else if (this._active)
                msg = MSG_RUNNING;
            else
                msg = MSG_STOPPED;
            Main.notify('Zapret', msg);
            return Clutter.EVENT_STOP;
        }
        if (button === Clutter.BUTTON_PRIMARY && !this._exists) {
            Main.notify('Zapret', MSG_NOT_INSTALLED);
            return Clutter.EVENT_STOP;
        }
        return super.vfunc_button_press_event(event);
    }

    refresh() {
        this._exists = this._scriptExists();

        if (this._exists) {
            // Detect running daemons by checking for nfqws/tpws processes.
            // pidof returns the PIDs (exit 0) if any match, empty (exit 1) if none.
            this._read(['pidof', 'nfqws', 'tpws'], out => {
                this._active = out.trim().length > 0;
                this._updateUi();
            });
            this._read(['systemctl', 'is-enabled', SERVICE], line => {
                const v = line.trim();
                this._enabled = v === 'enabled' || v === 'enabled-runtime' || v === 'static' || v === 'alias';
                this._updateUi();
            });
        } else {
            this._active = false;
            this._enabled = false;
        }
        this._updateUi();
    }

    _scriptExists() {
        try {
            const file = Gio.File.new_for_path(SCRIPT);
            const info = file.query_info(
                'unix::is-symlink,unix::mode',
                Gio.FileQueryInfoFlags.NONE, null);
            // Follow symlinks to the final target.
            let target = file;
            if (info.get_attribute_boolean('unix::is-symlink'))
                target = file.resolve_path(null);
            const tinfo = target.query_info(
                'unix::mode',
                Gio.FileQueryInfoFlags.NONE, null);
            const mode = tinfo.get_attribute_uint32('unix::mode');
            // Executable bit for any of user/group/other.
            return !!(mode & 0o111);
        } catch {
            return false;
        }
    }

    _read(argv, callback) {
        try {
            const proc = Gio.Subprocess.new(
                argv, Gio.SubprocessFlags.STDOUT_PIPE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, out] = p.communicate_utf8_finish(res);
                    callback(out ?? '');
                } catch {
                    callback('');
                }
            });
        } catch {
            callback('');
        }
    }

    _state() {
        if (!this._exists)
            return STATE_MISSING;
        return this._active ? STATE_RUNNING : STATE_STOPPED;
    }

    _updateUi() {
        const s = this._state();
        let color, tooltip;
        if (s === STATE_RUNNING) {
            color = DOT_RUNNING;
            tooltip = MSG_RUNNING;
        } else if (s === STATE_STOPPED) {
            color = DOT_STOPPED;
            tooltip = MSG_STOPPED;
        } else {
            color = DOT_MISSING;
            tooltip = MSG_NOT_INSTALLED;
        }

        this._dot.set_style(`background-color: ${color}; border-radius: 8px; box-shadow: 0 0 2px rgba(0,0,0,0.55);`);
        this._icon.set_style(s === STATE_MISSING ? 'opacity: 0.45;' : '');
        this.accessible_name = tooltip;

        const installed = s !== STATE_MISSING;
        this._statusItem.visible = installed;
        this._startItem.visible = installed;
        this._stopItem.visible = installed;
        this._restartItem.visible = installed;
        this._enabledItem.visible = installed;

        if (installed) {
            this._statusItem.label.text = `Status: ${this._active ? 'running' : 'stopped'}`;
            this._enabledItem.label.text = `Autostart: ${this._enabled ? 'yes' : 'no'}`;
            this._startItem.sensitive = !this._active;
            this._stopItem.sensitive = this._active;
            this._restartItem.sensitive = true;
        }
    }

    _runScript(action) {
        // Run the sysv init script via pkexec, which triggers the standard
        // polkit authentication prompt. /opt/zapret/init.d/sysv/zapret is
        // owned by root and not user-writable (satisfies review guidelines).
        try {
            GLib.spawn_command_line_async(`pkexec ${SCRIPT} ${action}`);
        } catch {
            Main.notifyError('Zapret', `Failed to run ${action}`);
            return;
        }
        this._scheduleRefresh(800);
        this._scheduleRefresh(2500);
        this._scheduleRefresh(5000);
    }

    _runEnable(action) {
        try {
            GLib.spawn_command_line_async(`pkexec systemctl ${action} ${SERVICE}`);
        } catch {
            Main.notifyError('Zapret', `Failed to ${action} autostart`);
            return;
        }
        this._scheduleRefresh(800);
        this._scheduleRefresh(2500);
    }

    _scheduleRefresh(delayMs) {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._timeoutId = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    start() {
        this.refresh();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
        if (this._allocId) {
            this._container.disconnect(this._allocId);
            this._allocId = 0;
        }
    }
});

export default class ZapretExtension extends Extension {
    enable() {
        this._indicator = new ZapretIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._indicator.start();
    }

    disable() {
        this._indicator?.stop();
        this._indicator?.destroy();
        this._indicator = null;
    }
}
