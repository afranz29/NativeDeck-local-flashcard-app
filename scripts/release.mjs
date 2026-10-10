// builds the app and publishes a GitHub release as a single atomic command.
//
// electron-builder's own --publish flow races two internal upload tasks
// against each other (the installer artifact and the update-feed metadata),
// and both end up creating a separate draft release for the same tag. doing
// the release creation ourselves in one gh call avoids that entirely.
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const version = pkg.version;
const tag = `v${version}`;
const releaseDir = path.join(process.cwd(), "release");

console.log(`building NativeDeck ${tag}...`);
execSync("npm run build", { stdio: "inherit" });
execSync("npx electron-builder --publish never", { stdio: "inherit" });

// electron-builder writes local files with spaces, but latest.yml (and the
// NSIS differential updater) reference the dash-separated form, and GitHub
// mangles spaces into dots on upload, so copy to the dash-separated name
// before uploading rather than relying on gh's display-label syntax (which
// only sets a label, not the actual served filename).
const renames = [
  { from: `NativeDeck Setup ${version}.exe`, to: `NativeDeck-Setup-${version}.exe` },
  { from: `NativeDeck Setup ${version}.exe.blockmap`, to: `NativeDeck-Setup-${version}.exe.blockmap` },
];
for (const { from, to } of renames) {
  const src = path.join(releaseDir, from);
  if (!existsSync(src)) {
    console.error(`missing expected build output: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, path.join(releaseDir, to));
}

const assetFiles = [...renames.map((r) => r.to), "latest.yml"];
for (const file of assetFiles) {
  const full = path.join(releaseDir, file);
  if (!existsSync(full)) {
    console.error(`missing expected build output: ${full}`);
    process.exit(1);
  }
}

console.log(`creating GitHub release ${tag}...`);
const args = [
  "release",
  "create",
  tag,
  ...assetFiles.map((file) => path.join(releaseDir, file)),
  "--title",
  version,
  "--notes",
  `NativeDeck ${version}`,
];
execFileSync("gh", args, { stdio: "inherit" });

console.log(`published ${tag}`);
