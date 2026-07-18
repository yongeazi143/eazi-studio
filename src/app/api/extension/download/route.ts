import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { db } from "@/utils/db";

// Helper to recursively add files to the JSZip instance
function addFilesToZip(dirPath: string, zipFolder: JSZip) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    // Skip git folders, node_modules, and nested ZIPs if any
    if (file === ".git" || file === "node_modules" || file.endsWith(".zip")) {
      continue;
    }

    if (stat.isDirectory()) {
      const newFolder = zipFolder.folder(file);
      if (newFolder) {
        addFilesToZip(filePath, newFolder);
      }
    } else {
      const fileData = fs.readFileSync(filePath);
      zipFolder.file(file, fileData);
    }
  }
}

// Helper to compile the current extension folder into a zip buffer
async function compileExtensionZip(): Promise<Buffer> {
  const extensionDir = path.join(process.cwd(), "..", "chrome-extension");
  if (!fs.existsSync(extensionDir)) {
    throw new Error("Extension folder not found at " + extensionDir);
  }

  const zip = new JSZip();
  addFilesToZip(extensionDir, zip);
  
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return zipBuffer;
}

// GET: Serve the latest packaged extension from database
export async function GET() {
  try {
    // 1. Try to find the latest release in the database
    let release = await db.extensionRelease.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let zipBuffer: Buffer;

    if (!release) {
      console.log("No packaged extension found in database. Compiling and saving first release...");
      // Compile on-the-fly
      zipBuffer = await compileExtensionZip();

      // Read manifest version if possible
      let version = "1.0.0";
      try {
        const manifestPath = path.join(process.cwd(), "..", "chrome-extension", "manifest.json");
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          if (manifest.version) {
            version = manifest.version;
          }
        }
      } catch (_) {}

      // Save to database
      release = await db.extensionRelease.create({
        data: {
          version,
          zipData: new Uint8Array(zipBuffer),
        },
      });
      console.log("First release saved to database. ID:", release.id);
    } else {
      zipBuffer = Buffer.from(release.zipData);
    }

    // 2. Stream the zip file to the client
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="eazi-flow-automator.zip"',
        "Content-Length": zipBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Failed to download extension package:", err);
    return NextResponse.json(
      { error: "Failed to download extension package: " + err.message },
      { status: 500 }
    );
  }
}

// POST: Package the current extension folder and save it to the database as a new release
export async function POST() {
  try {
    console.log("Compiling new extension release...");
    const zipBuffer = await compileExtensionZip();

    // Read manifest.json to extract the version if it exists
    let version = "1.0.0";
    try {
      const manifestPath = path.join(process.cwd(), "..", "chrome-extension", "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (manifest.version) {
          version = manifest.version;
        }
      }
    } catch (manifestErr) {
      console.warn("Could not read manifest version, using default:", manifestErr);
    }

    const release = await db.extensionRelease.create({
      data: {
        version,
        zipData: new Uint8Array(zipBuffer),
      },
    });

    console.log(`Successfully packaged version ${version} and saved to database. ID: ${release.id}`);

    return NextResponse.json({
      success: true,
      id: release.id,
      version: release.version,
      createdAt: release.createdAt,
      sizeBytes: zipBuffer.length,
    });
  } catch (err: any) {
    console.error("Failed to compile and save extension release:", err);
    return NextResponse.json(
      { error: "Failed to package and save extension: " + err.message },
      { status: 500 }
    );
  }
}
