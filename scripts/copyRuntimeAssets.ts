import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildDirectory = path.resolve(scriptDirectory, "..");
const projectDirectory = path.resolve(buildDirectory, "..");

await Promise.all([
    cp(path.join(projectDirectory, "views"), path.join(buildDirectory, "views"), {
        recursive: true
    }),
    mkdir(path.join(buildDirectory, "public"), { recursive: true }),
    cp(path.join(projectDirectory, "public", "css"), path.join(buildDirectory, "public", "css"), {
        recursive: true
    }),
    cp(
        path.join(projectDirectory, "public", "images"),
        path.join(buildDirectory, "public", "images"),
        { recursive: true }
    )
]);
