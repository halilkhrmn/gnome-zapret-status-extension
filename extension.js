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
            extension.path, 'icons', 'zapret-z-symbolic.svg']);
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
        this._startItem.connect('activate', () => this._runSystemctl('start'));
        this.menu.addMenuItem(this._startItem);

        this._stopItem = new PopupMenu.PopupMenuItem('Stop');
        this._stopItem.connect('activate', () => this._runSystemctl('stop'));
        this.menu.addMenuItem(this._stopItem);

        this._restartItem = new PopupMenu.PopupMenuItem('Restart');
        this._restartItem.connect('activate', () => this._runSystemctl('restart'));
        this.menu.addMenuItem(this._restartItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._checkItem = new PopupMenu.PopupMenuItem('Detailed status');
        this._checkItem.connect('activate', () => this._showDetailedStatus());
        this.menu.addMenuItem(this._checkItem);

        this._enabledItem = new PopupMenu.PopupMenuItem('');
        this._enabledItem.connect('activate', () => {
            this._runSystemctl(this._enabled ? 'disable' : 'enable');
        });
        this.menu.addMenuItem(this._enabledItem);

        this._active = false;
        this._enabled = false;
        this._exists = true;
        this._timeoutId = 0;
        this._pollId = 0;
        this._allocId = 0;
    }

    vfunc_button_press_event(event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_SECONDARY) {
            Main.notify('Zapret', this._exists
                ? (this._active ? MSG_RUNNING : MSG_STOPPED)
                : MSG_NOT_INSTALLED);
            return Clutter.EVENT_STOP;
        }
        if (button === Clutter.BUTTON_PRIMARY && !this._exists) {
            Main.notify('Zapret', MSG_NOT_INSTALLED);
            return Clutter.EVENT_STOP;
        }
        return super.vfunc_button_press_event(event);
    }

    refresh() {
        this._exists = this._serviceExists();

        if (this._exists) {
            this._read(['systemctl', 'is-active', SERVICE], (line) => {
                this._active = line.trim() === 'active';
                this._updateUi();
            });
            this._read(['systemctl', 'is-enabled', SERVICE], (line) => {
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

    _serviceExists() {
        try {
            const [, out] = GLib.spawn_sync(null,
                ['systemctl', 'list-unit-files', '--no-legend', SERVICE],
                null, GLib.SpawnFlags.SEARCH_PATH, null);
            const txt = new TextDecoder().decode(out).trim();
            return txt.length > 0 && txt.split(/\s+/)[0] === SERVICE;
        } catch (e) {
            return false;
        }
    }

    _read(argv, callback) {
        try {
            const [, out] = GLib.spawn_sync(null, argv, null,
                GLib.SpawnFlags.SEARCH_PATH, null);
            callback(new TextDecoder().decode(out));
        } catch (e) {
            callback('');
        }
    }

    _state() {
        if (!this._exists) return STATE_MISSING;
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
        this._checkItem.visible = installed;
        this._enabledItem.visible = installed;

        if (installed) {
            this._statusItem.label.text = `Status: ${this._active ? 'running' : 'stopped'}`;
            this._enabledItem.label.text = `Autostart: ${this._enabled ? 'yes' : 'no'}`;
            this._startItem.sensitive = !this._active;
            this._stopItem.sensitive = this._active;
            this._restartItem.sensitive = true;
        }
    }

    _runSystemctl(action) {
        try {
            GLib.spawn_command_line_async(`systemctl ${action} ${SERVICE}`);
        } catch (e) {
            Main.notifyError('Zapret', `Failed to run systemctl ${action}`);
            return;
        }
        this._scheduleRefresh(800);
        this._scheduleRefresh(2500);
    }

    _scheduleRefresh(delayMs) {
        if (this._timeoutId) GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._timeoutId = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _showDetailedStatus() {
        try {
            const [, out] = GLib.spawn_sync(null,
                ['systemctl', 'status', SERVICE, '--no-pager', '--full'],
                null, GLib.SpawnFlags.SEARCH_PATH, null);
            const text = new TextDecoder().decode(out) || '(no output)';
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
            Main.notify('Zapret', 'Detailed status copied to clipboard');
        } catch (e) {
            Main.notifyError('Zapret', 'Failed to read status');
        }
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