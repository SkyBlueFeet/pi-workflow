import { deflateSync, inflateSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_CENTRAL_DIR_SIG = 0x06054b50;

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly compressionMethod: number;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt16LE(value, offset);
}

function writeU32(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt32LE(value, offset);
}

export function createZip(files: Map<string, Buffer>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  const fileDataOffsets: number[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const compressed = data.length > 0 ? deflateSync(data, { level: 6 }) : data;
    const useCompression = compressed.length < data.length ? 8 : 0;
    const finalData = useCompression === 8 ? compressed : data;
    const check = crc32(data);

    const nameBuf = Buffer.from(name, "utf-8");
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    writeU32(localHeader, 0, LOCAL_FILE_HEADER_SIG);
    writeU16(localHeader, 4, 20);
    writeU16(localHeader, 6, 0);
    writeU16(localHeader, 8, useCompression);
    writeU16(localHeader, 10, 0);
    writeU16(localHeader, 12, 0);
    writeU32(localHeader, 14, check);
    writeU32(localHeader, 18, finalData.length);
    writeU32(localHeader, 22, data.length);
    writeU16(localHeader, 26, nameBuf.length);
    writeU16(localHeader, 28, 0);
    nameBuf.copy(localHeader, 30);

    fileDataOffsets.push(offset);
    localHeaders.push(localHeader);
    localHeaders.push(finalData);
    offset += 30 + nameBuf.length + finalData.length;

    const versionMadeBy = 20;
    const centralEntry = Buffer.alloc(46 + nameBuf.length);
    writeU32(centralEntry, 0, CENTRAL_DIR_HEADER_SIG);
    writeU16(centralEntry, 4, versionMadeBy);
    writeU16(centralEntry, 6, 20);
    writeU16(centralEntry, 8, 0);
    writeU16(centralEntry, 10, useCompression);
    writeU16(centralEntry, 12, 0);
    writeU16(centralEntry, 14, 0);
    writeU32(centralEntry, 16, check);
    writeU32(centralEntry, 20, finalData.length);
    writeU32(centralEntry, 24, data.length);
    writeU16(centralEntry, 28, nameBuf.length);
    writeU16(centralEntry, 30, 0);
    writeU16(centralEntry, 32, 0);
    writeU16(centralEntry, 34, 0);
    writeU16(centralEntry, 36, 0);
    writeU32(centralEntry, 38, 0);
    writeU32(centralEntry, 42, fileDataOffsets[fileDataOffsets.length - 1]);
    nameBuf.copy(centralEntry, 46);

    centralEntries.push(centralEntry);
  }

  const centralDirOffset = offset;
  const centralDirSize = centralEntries.reduce((s, e) => s + e.length, 0);
  const centralDir = Buffer.concat(centralEntries);

  const eocd = Buffer.alloc(22);
  writeU32(eocd, 0, END_CENTRAL_DIR_SIG);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, files.size);
  writeU16(eocd, 10, files.size);
  writeU32(eocd, 12, centralDirSize);
  writeU32(eocd, 16, centralDirOffset);
  writeU16(eocd, 20, 0);

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

export function readZip(data: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) throw new Error("无效的 ZIP 文件: 未找到 EOCD 记录");

  const _centralDirSize = data.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = data.readUInt32LE(eocdOffset + 16);
  const numEntries = data.readUInt16LE(eocdOffset + 10);

  let pos = centralDirOffset;
  for (let i = 0; i < numEntries; i++) {
    if (data.readUInt32LE(pos) !== CENTRAL_DIR_HEADER_SIG) {
      throw new Error("无效的 ZIP 文件: 中央目录条目签名错误");
    }

    const compressionMethod = data.readUInt16LE(pos + 10);
    data.readUInt32LE(pos + 16);
    const compressedSize = data.readUInt32LE(pos + 20);
    const _uncompressedSize = data.readUInt32LE(pos + 24);
    const nameLen = data.readUInt16LE(pos + 28);
    const extraLen = data.readUInt16LE(pos + 30);
    const localOffset = data.readUInt32LE(pos + 42);

    const name = data.toString("utf-8", pos + 46, pos + 46 + nameLen);

    const localPos = localOffset;
    const localNameLen = data.readUInt16LE(localPos + 26);
    const localExtraLen = data.readUInt16LE(localPos + 28);
    const fileDataStart = localPos + 30 + localNameLen + localExtraLen;
    let fileData = data.subarray(fileDataStart, fileDataStart + compressedSize);

    if (compressionMethod === 8) {
      fileData = inflateSync(fileData);
    }

    entries.set(name, fileData);

    pos += 46 + nameLen + extraLen;
  }

  return entries;
}

export function listZipEntries(data: Buffer): string[] {
  const entries: string[] = [];
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) throw new Error("无效的 ZIP 文件: 未找到 EOCD 记录");

  const centralDirOffset = data.readUInt32LE(eocdOffset + 16);
  const numEntries = data.readUInt16LE(eocdOffset + 10);

  let pos = centralDirOffset;
  for (let i = 0; i < numEntries; i++) {
    const nameLen = data.readUInt16LE(pos + 28);
    const extraLen = data.readUInt16LE(pos + 30);
    const name = data.toString("utf-8", pos + 46, pos + 46 + nameLen);
    entries.push(name);
    pos += 46 + nameLen + extraLen;
  }

  return entries;
}

function findEndOfCentralDirectory(data: Buffer): number {
  const start = Math.max(0, data.length - 65557);
  for (let i = data.length - 22; i >= start; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}
