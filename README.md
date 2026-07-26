# GNOME Zapret Status Extension

A GNOME Shell panel extension that shows the status of the zapret service in
the top bar via a **Z** icon with a colored status dot, and exposes a menu to
start / stop / restart / show detailed status / toggle boot autostart.

> **This extension is a control GUI for [zapret](https://github.com/bol-van/zapret)
> and will not do anything useful without it.** zapret must be installed and
> its init script available at `/opt/zapret/init.d/sysv/zapret`.
>
> Install guide: https://keift.gitbook.io/guides/linux/install-zapret
> Upstream project: https://github.com/bol-van/zapret

## How it works

zapret ships a SysV init script at `/opt/zapret/init.d/sysv/zapret` that
manages the `nfqws`/`tpws` daemons and the firewall rules. The systemd unit
`zapret.service` only wraps that script, but because the daemons fork without
writing a `PIDFile=`, systemd cannot reliably track them. For that reason this
extension drives the init script directly and detects the running state from
the actual daemon processes instead of `systemctl is-active`.

| Action | Command |
|--------|---------|
| Start / Stop / Restart | `pkexec /opt/zapret/init.d/sysv/zapret start\|stop\|restart` |
| Enable / Disable autostart (boot) | `pkexec systemctl enable\|disable zapret.service` |
| Running state | `pidof nfqws tpws` (non-empty = running) |
| Installed check | `/opt/zapret/init.d/sysv/zapret` is executable |
| Autostart check | `systemctl is-enabled zapret.service` |

`pkexec` triggers the standard polkit authentication prompt when an action is
triggered, so Start/Stop/Restart and enable/disable require entering an admin
password. No extra setup is needed.

Status monitoring (icon, dot, menu status line, detailed status) only reads
state and does not require any authorization.

## Panel indicator

The panel shows a **Z** glyph with a small colored dot in the bottom-right
corner:

| Dot color | Meaning                          |
|-----------|----------------------------------|
| green     | zapret is running (daemons alive) |
| orange    | zapret is stopped                |
| red       | zapret is not installed          |

When zapret is not installed, all menu actions are disabled and the Z icon
is dimmed. Left/right-clicking shows a notification: *Zapret is not installed*.

## Installation

### Extension

Install into the user directory:

```sh
UUID=gnome-zapret@halilkhrmn.github.io
mkdir -p ~/.local/share/gnome-shell/extensions/$UUID
cp metadata.json extension.js icons ~/.local/share/gnome-shell/extensions/$UUID/
```

Under Wayland, GNOME Shell only scans for new extensions at startup, so log out
and back in. On X11 you can restart the shell with `Alt+F2 → r`. Then enable:

```sh
gnome-extensions enable gnome-zapret@halilkhrmn.github.io
```

or toggle it from **Settings → Extensions**.

### Test from source

You can also test from the source tree by symlinking:

```sh
ln -s "$PWD" ~/.local/share/gnome-shell/extensions/gnome-zapret@halilkhrmn.github.io
```

## Packaging for extensions.gnome.org

```sh
./build.sh
```

Produces `build/<uuid>.shell-extension.zip` containing only the extension
files (metadata.json, extension.js, icons/). README and LICENSE are
intentionally excluded per the review guidelines.

## CLI control

You can do everything from the command line as well:

```sh
# Start / stop / restart (root required)
sudo /opt/zapret/init.d/sysv/zapret start
sudo /opt/zapret/init.d/sysv/zapret stop
sudo /opt/zapret/init.d/sysv/zapret restart

# Check running state
pidof nfqws tpws
pgrep -a nfqws
pgrep -a tpws

# Boot autostart
sudo systemctl enable zapret.service
sudo systemctl disable zapret.service
systemctl is-enabled zapret.service
```

For a detailed blocking check:

```sh
sudo /opt/zapret/blockcheck.sh
```

## Notes

- Status is refreshed every 10 seconds and after each action.
- "Detailed status" copies running daemons, `systemctl is-active/is-enabled`
  and `systemctl status` output to the clipboard.
- `Alt+F2 r` does not work under Wayland; log out and back in.