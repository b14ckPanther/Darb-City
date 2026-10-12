// A minimal, dependency-free writer for small PMTiles v3 archives of Mapbox Vector Tiles, used to
// generate the e2e fixture. Specs: github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md and
// github.com/mapbox/vector-tile-spec/tree/master/2.1

// ---- Protocol buffers ----
function varint(out, value) {
  let v = BigInt(value);
  while (v >= 0x80n) {
    out.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  out.push(Number(v));
}
const zigzag = (n) => (n << 1) ^ (n >> 31);
const tag = (field, wire) => (field << 3) | wire;
function bytesField(out, field, bytes) {
  varint(out, tag(field, 2));
  varint(out, bytes.length);
  for (const b of bytes) out.push(b);
}
function uintField(out, field, value) {
  varint(out, tag(field, 0));
  varint(out, value);
}
function packedField(out, field, values) {
  const body = [];
  for (const v of values) varint(body, v);
  bytesField(out, field, body);
}
const utf8 = (text) => [...Buffer.from(text, "utf8")];

// ---- Mapbox Vector Tile 2.1 ----
export const EXTENT = 4096;
const command = (id, count) => (id & 7) | (count << 3);

/** Rings or lines in tile coordinates; `close` adds ClosePath (polygons). */
function geometry(parts, close) {
  const out = [];
  let x = 0;
  let y = 0;
  for (const [first, ...rest] of parts) {
    out.push(command(1, 1), zigzag(first[0] - x), zigzag(first[1] - y));
    [x, y] = first;
    out.push(command(2, rest.length));
    for (const [nx, ny] of rest) {
      out.push(zigzag(nx - x), zigzag(ny - y));
      [x, y] = [nx, ny];
    }
    if (close) out.push(command(7, 1));
  }
  return out;
}

/** features: { type: 1 point | 2 line | 3 polygon, geometry: number[], properties: { [k]: string } } */
function layer(name, features) {
  const keys = [];
  const values = [];
  const indexOf = (list, value) => {
    const found = list.indexOf(value);
    return found >= 0 ? found : list.push(value) - 1;
  };
  const out = [];
  uintField(out, 15, 2);
  bytesField(out, 1, utf8(name));
  for (const feature of features) {
    const tags = Object.entries(feature.properties).flatMap(([k, v]) => [
      indexOf(keys, k),
      indexOf(values, v),
    ]);
    const body = [];
    packedField(body, 2, tags);
    uintField(body, 3, feature.type);
    packedField(body, 4, feature.geometry);
    bytesField(out, 2, body);
  }
  for (const k of keys) bytesField(out, 3, utf8(k));
  for (const v of values) {
    const value = [];
    bytesField(value, 1, utf8(v));
    bytesField(out, 4, value);
  }
  uintField(out, 5, EXTENT);
  return out;
}

/** One tile: land over the whole tile (Protomaps "earth") and a diagonal highway ("roads"). */
export function testTile() {
  const out = [];
  // Exterior rings wind clockwise in tile coordinates (y down), as the MVT spec requires.
  const land = [
    [0, 0],
    [EXTENT, 0],
    [EXTENT, EXTENT],
    [0, EXTENT],
  ];
  const road = [
    [0, 0],
    [EXTENT, EXTENT],
  ];
  bytesField(
    out,
    3,
    layer("earth", [{ type: 3, geometry: geometry([land], true), properties: { kind: "earth" } }]),
  );
  bytesField(
    out,
    3,
    layer("roads", [
      { type: 2, geometry: geometry([road], false), properties: { kind: "highway" } },
    ]),
  );
  return Buffer.from(out);
}

// ---- PMTiles v3 ----
/** The Hilbert tile id of z/x/y (PMTiles v3 spec, "Tile ID"). */
export function zxyToTileId(z, x, y) {
  let id = 0;
  for (let t = 0; t < z; t++) id += 4 ** t;
  let px = x;
  let py = y;
  for (let s = 2 ** z / 2; s >= 1; s /= 2) {
    const rx = (px & s) > 0 ? 1 : 0;
    const ry = (py & s) > 0 ? 1 : 0;
    id += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        px = s - 1 - px;
        py = s - 1 - py;
      }
      [px, py] = [py, px];
    }
  }
  return id;
}

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Every tile of the bbox at minZoom..maxZoom, all sharing one copy of testTile(). */
export function buildArchive({ bbox, minZoom, maxZoom }) {
  const [west, south, east, north] = bbox;
  const tile = testTile();
  const ids = [];
  for (let z = minZoom; z <= maxZoom; z++)
    for (let x = lonToX(west, z); x <= lonToX(east, z); x++)
      for (let y = latToY(north, z); y <= latToY(south, z); y++) ids.push(zxyToTileId(z, x, y));
  ids.sort((a, b) => a - b);

  const directory = [];
  varint(directory, ids.length);
  let last = 0;
  for (const id of ids) {
    varint(directory, id - last);
    last = id;
  }
  for (let i = 0; i < ids.length; i++) varint(directory, 1); // run lengths
  for (let i = 0; i < ids.length; i++) varint(directory, tile.length); // lengths
  for (let i = 0; i < ids.length; i++) varint(directory, 1); // offset 0, stored as offset + 1
  const root = Buffer.from(directory);
  const metadata = Buffer.from(
    JSON.stringify({
      name: "darb-test-tiles",
      attribution: "Darb test fixture",
      vector_layers: [
        { id: "earth", fields: { kind: "String" } },
        { id: "roads", fields: { kind: "String" } },
      ],
    }),
  );

  const header = Buffer.alloc(127);
  const u64 = (at, value) => header.writeBigUInt64LE(BigInt(value), at);
  const e7 = (degrees) => Math.round(degrees * 1e7);
  header.write("PMTiles", 0, "ascii");
  header.writeUInt8(3, 7);
  const rootAt = 127;
  const metadataAt = rootAt + root.length;
  const tilesAt = metadataAt + metadata.length;
  u64(8, rootAt);
  u64(16, root.length);
  u64(24, metadataAt);
  u64(32, metadata.length);
  u64(40, tilesAt); // no leaf directories
  u64(48, 0);
  u64(56, tilesAt);
  u64(64, tile.length);
  u64(72, ids.length); // addressed tiles
  u64(80, ids.length); // tile entries
  u64(88, 1); // tile contents
  header.writeUInt8(0, 96); // not clustered: every entry points at the same bytes
  header.writeUInt8(1, 97); // internal compression: none
  header.writeUInt8(1, 98); // tile compression: none
  header.writeUInt8(1, 99); // tile type: MVT
  header.writeUInt8(minZoom, 100);
  header.writeUInt8(maxZoom, 101);
  header.writeInt32LE(e7(west), 102);
  header.writeInt32LE(e7(south), 106);
  header.writeInt32LE(e7(east), 110);
  header.writeInt32LE(e7(north), 114);
  header.writeUInt8(Math.floor((minZoom + maxZoom) / 2), 118);
  header.writeInt32LE(e7((west + east) / 2), 119);
  header.writeInt32LE(e7((south + north) / 2), 123);
  return Buffer.concat([header, root, metadata, tile]);
}
