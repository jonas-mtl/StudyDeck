import fs from "node:fs";

const version = JSON.parse(fs.readFileSync("version.json", "utf8")).version;

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Ungültige Version: ${version}`);
}

// package.json
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = version;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// tauri.conf.json
const path = "src-tauri/tauri.conf.json";
const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.version = version;
fs.writeFileSync(path, JSON.stringify(config, null, 2) + "\n");

// Cargo.toml: Nur Version im [package]-Abschnitt ändern
const cargoPath = "src-tauri/Cargo.toml";
let cargo = fs.readFileSync(cargoPath, "utf8");

const packageSection = /(\[package\][\s\S]*?)(?=\n\[|$)/;
const match = cargo.match(packageSection);

if (!match) throw new Error("Cargo.toml: [package] nicht gefunden");

const updatedSection = match[1].replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`,
);

if (
  updatedSection === match[1] &&
  !match[1].includes(`version = "${version}"`)
) {
  throw new Error("Cargo.toml: package.version nicht gefunden");
}

cargo = cargo.replace(packageSection, updatedSection);
fs.writeFileSync(cargoPath, cargo);

console.log(`StudyDeck-Version synchronisiert: ${version}`);
