# Installing Rhino Team Services

Desktop app that embeds Taiga, Mattermost, MiroTalk, Calendar and CryptPad in
one window. Builds are provided for **macOS (Apple Silicon / arm64)** and
**Linux (x86_64 and arm64)**.

These instructions are for **installing a finished build**. To produce the
artifacts yourself, see [Building the artifacts](#building-the-artifacts) at the
bottom.

---

## Linux (`.deb`)

The `.deb` targets Debian/Ubuntu-based distros (including Rhino Linux). Pick the
file matching your CPU architecture:

```
rhino-team-services_0.1.0_amd64.deb   # x86_64 (Intel/AMD)
rhino-team-services_0.1.0_arm64.deb   # arm64 (ARM)
```

### Install

```bash
sudo apt install ./rhino-team-services_0.1.0_arm64.deb
```

> Use the full path (the `./` matters) so `apt` treats it as a local file and
> resolves dependencies automatically.

On older systems without `apt install ./file` support, use `dpkg` and then pull
in any missing dependencies:

```bash
sudo dpkg -i rhino-team-services_0.1.0_arm64.deb
sudo apt-get install -f   # fixes missing dependencies, if any
```

### Launch

- From your application menu, search for **Rhino Team Services**, or
- From a terminal:
  ```bash
  rhino-team-services
  ```

### Update

Install the newer `.deb` the same way — it upgrades the existing package in
place.

### Uninstall

```bash
sudo apt remove rhino-team-services
```

---

## macOS (Tahoe, macOS 26) — arm64

The macOS build ships as a `.dmg` (and a `.zip`). It is **not signed with an
Apple Developer ID**, so Gatekeeper on Tahoe will block the first launch and
needs one manual approval. This is expected and only has to be done once.

### Install

1. Open the `.dmg` (e.g. `Rhino Team Services-0.1.0-arm64.dmg`).
2. Drag **Rhino Team Services** into the **Applications** folder.
3. Eject the disk image.

### First launch on Tahoe

Because the app is unsigned, double-clicking it the first time shows a message
like *"Apple could not verify 'Rhino Team Services' is free of malware."*

Approve it once:

1. Double-click the app (it gets blocked — that's fine, dismiss the dialog).
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the **Security** section. You'll see a note that *"Rhino Team
   Services" was blocked*. Click **Open Anyway**.
4. Authenticate (Touch ID / password), then click **Open** in the final
   confirmation.

After this one-time approval, the app launches normally from then on.

> On macOS Tahoe the older "right-click → Open" shortcut no longer bypasses
> Gatekeeper for unsigned apps, so use the **Privacy & Security → Open Anyway**
> path above.

### Terminal alternative (one command)

If you'd rather skip the System Settings step, strip the quarantine flag after
copying the app to Applications:

```bash
xattr -dr com.apple.quarantine "/Applications/Rhino Team Services.app"
```

The app will then open with a normal double-click.

### Update

Replace the app in **Applications** with the new version (the `.dmg` will offer
to overwrite). If macOS re-prompts, repeat the one-time approval above.

### Uninstall

Drag **Rhino Team Services** from **Applications** to the Trash.

---

## Building the artifacts

Official builds are produced by **GitHub Actions** — see
[`.github/workflows/release.yml`](.github/workflows/release.yml). Pushing a
`v*` tag (e.g. `v0.1.0`) builds and publishes the artifacts for:

- **macOS** (Apple Silicon / arm64) — `.dmg` + `.zip`
- **Linux x86_64** — `.deb`
- **Linux arm64** — `.deb`

Each platform is packaged natively on its matching runner, so no Docker or
cross-compilation toolchain is needed.

### Building locally

Requires [Bun](https://bun.sh) and the **native** platform toolchain — i.e.
build macOS artifacts on a Mac, and Linux `.deb` artifacts on a Linux machine of
the matching architecture. Bun is only needed to **build**; end users do not
need it installed.

```bash
bun install
```

#### macOS (`.dmg` + `.zip`) — run on a Mac (Apple Silicon)

```bash
bun run dist:mac
```

#### Linux (`.deb`) — run on Linux (x86_64 or arm64)

```bash
bun run dist:linux
```

> On arm64 Linux, electron-builder's bundled `fpm` is x86-only, so install a
> native one and let electron-builder use it:
>
> ```bash
> sudo apt-get install -y ruby ruby-dev build-essential fakeroot
> sudo gem install --no-document fpm
> USE_SYSTEM_FPM=true bun run dist:linux
> ```

Artifacts are written to the `release/` directory, e.g.:

- `Rhino Team Services-0.1.0-arm64.dmg` / `…-arm64-mac.zip`
- `rhino-team-services_0.1.0_amd64.deb`
- `rhino-team-services_0.1.0_arm64.deb`

</content>
</invoke>
