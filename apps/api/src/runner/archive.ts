import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extract, pack } from "tar-stream";

/**
 * Tar helpers for moving files in and out of a runner container.
 *
 * The API talks to Docker over a socket only: it never bind-mounts a host
 * directory, because in production the API itself runs in a container and any
 * bind mount would be resolved against the host filesystem rather than the
 * API container's. Sources go in with `putArchive`, results come back out with
 * `getArchive`, which behaves identically in development and in production.
 */

export interface ArchiveFile {
  /** Path relative to the archive root, e.g. "prog.c". */
  name: string;
  contents: string | Buffer;
  /** Unix mode; defaults to 0o644. */
  mode?: number;
}

/** Builds a tar stream owned by uid/gid 1000 (the runner image's `ubuntu` user). */
export function packFiles(files: readonly ArchiveFile[]): Readable {
  const packer = pack();
  for (const file of files) {
    const contents = Buffer.isBuffer(file.contents) ? file.contents : Buffer.from(file.contents, "utf8");
    packer.entry(
      {
        name: file.name,
        mode: file.mode ?? 0o644,
        uid: 1000,
        gid: 1000,
        uname: "ubuntu",
        gname: "ubuntu",
        size: contents.length,
        type: "file",
      },
      contents,
    );
  }
  packer.finalize();
  return packer;
}

/**
 * Reads the files named in `wanted` out of a tar stream produced by
 * `getArchive({ path: "/work" })`, whose entries are prefixed with `work/`.
 *
 * Each file is read up to `readLimit` bytes — callers pass one byte more than
 * the reported cap so that "exactly at the cap" stays distinguishable from
 * "truncated" — and entries that were not asked for are drained so the stream
 * keeps flowing.
 */
export async function extractFiles(
  archive: NodeJS.ReadableStream,
  wanted: readonly string[],
  readLimit: number,
): Promise<Map<string, Buffer>> {
  const wantedSet = new Set(wanted);
  const files = new Map<string, Buffer>();
  const extractor = extract();

  extractor.on("entry", (header, stream, next) => {
    const name = header.name.replace(/^\.?\/?work\/?/, "");
    if (header.type !== "file" || !wantedSet.has(name)) {
      stream.on("end", next);
      stream.resume();
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    stream.on("data", (chunk: Buffer) => {
      if (total >= readLimit) return;
      const slice = chunk.subarray(0, readLimit - total);
      chunks.push(slice);
      total += slice.length;
    });
    stream.on("end", () => {
      files.set(name, Buffer.concat(chunks));
      next();
    });
    stream.on("error", next);
  });

  await pipeline(archive, extractor);
  return files;
}
