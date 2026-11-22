// ============================================================
// ISO/IEC 18004 QR Code Encoder (Pure JS, Offline, Versions 1-15)
// Supports Byte Mode (UTF-8) & Error Correction Levels L / M / Q / H
// ============================================================

(function (global) {
  'use strict';

  const ECL = {
    L: { ordinal: 0, formatBits: 1 },
    M: { ordinal: 1, formatBits: 0 },
    Q: { ordinal: 2, formatBits: 3 },
    H: { ordinal: 3, formatBits: 2 },
  };

  // ISO/IEC 18004 Table 9: ECC codewords per block (Versions 1..15)
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22], // L
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24], // M
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30], // Q
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24], // H
  ];

  // ISO/IEC 18004 Table 9: Number of error-correction blocks (Versions 1..15)
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6], // L
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10], // M
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12], // Q
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18], // H
  ];

  const MAX_VERSION = 15;

  function getNumRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return (
      Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
    );
  }

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  function gfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function reedSolomonDivisor(degree) {
    const result = new Uint8Array(degree);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < result.length) {
          result[j] ^= result[j + 1];
        }
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function reedSolomonRemainder(data, divisor) {
    const result = new Uint8Array(divisor.length);
    for (let i = 0; i < data.length; i += 1) {
      const factor = data[i] ^ result[0];
      result.copyWithin(0, 1);
      result[result.length - 1] = 0;
      for (let j = 0; j < divisor.length; j += 1) {
        result[j] ^= gfMultiply(divisor[j], factor);
      }
    }
    return result;
  }

  function appendBits(val, len, bitBuf) {
    for (let i = len - 1; i >= 0; i -= 1) {
      bitBuf.push((val >>> i) & 1);
    }
  }

  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const encoded = unescape(encodeURIComponent(str));
    const bytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i += 1) {
      bytes[i] = encoded.charCodeAt(i);
    }
    return bytes;
  }

  function encodeDataAndEcc(bytes, ver, ecl) {
    const dataCapacityBytes = getNumDataCodewords(ver, ecl);
    const dataCapacityBits = dataCapacityBytes * 8;
    const countBits = ver <= 9 ? 8 : 16;

    const bits = [];
    appendBits(0x4, 4, bits); // Byte mode indicator (0100)
    appendBits(bytes.length, countBits, bits);
    for (let i = 0; i < bytes.length; i += 1) {
      appendBits(bytes[i], 8, bits);
    }

    // Terminator (up to 4 zero bits)
    const termLen = Math.min(4, dataCapacityBits - bits.length);
    appendBits(0, termLen, bits);

    // Pad to byte boundary
    const alignPad = (8 - (bits.length % 8)) % 8;
    appendBits(0, alignPad, bits);

    // Alternating pad bytes 0xEC, 0x11
    for (let padByte = 0xec; bits.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) {
      appendBits(padByte, 8, bits);
    }

    const dataCodewords = new Uint8Array(dataCapacityBytes);
    for (let i = 0; i < bits.length; i += 1) {
      dataCodewords[i >>> 3] |= bits[i] << (7 - (i & 7));
    }

    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks = [];
    const rsDiv = reedSolomonDivisor(blockEccLen);
    let offset = 0;
    for (let i = 0; i < numBlocks; i += 1) {
      const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      const dat = dataCodewords.subarray(offset, offset + datLen);
      offset += datLen;
      const ecc = reedSolomonRemainder(dat, rsDiv);
      blocks.push({ dat, ecc });
    }

    const interleaved = [];
    const maxDataLen = shortBlockLen - blockEccLen + (numShortBlocks < numBlocks ? 1 : 0);
    for (let i = 0; i < maxDataLen; i += 1) {
      for (let b = 0; b < blocks.length; b += 1) {
        if (i < blocks[b].dat.length) {
          interleaved.push(blocks[b].dat[i]);
        }
      }
    }
    for (let i = 0; i < blockEccLen; i += 1) {
      for (let b = 0; b < blocks.length; b += 1) {
        interleaved.push(blocks[b].ecc[i]);
      }
    }

    return new Uint8Array(interleaved);
  }

  function createMatrix(size) {
    const m = new Array(size);
    for (let y = 0; y < size; y += 1) {
      m[y] = new Uint8Array(size);
    }
    return m;
  }

  function cloneMatrix(m) {
    return m.map((row) => new Uint8Array(row));
  }

  function buildQrMatrix(text, eclName) {
    const ecl = ECL[eclName] || ECL.H;
    const bytes = utf8Encode(text);

    // Chọn phiên bản QR nhỏ nhất đủ chứa dữ liệu
    let ver = -1;
    for (let v = 1; v <= MAX_VERSION; v += 1) {
      const countBits = v <= 9 ? 8 : 16;
      const neededBits = 4 + countBits + bytes.length * 8;
      if (neededBits <= getNumDataCodewords(v, ecl) * 8) {
        ver = v;
        break;
      }
    }
    if (ver === -1) {
      throw new Error('Đường link quá dài để tạo mã QR (vượt quá giới hạn Version 15).');
    }

    const size = ver * 4 + 17;
    const modules = createMatrix(size);
    const isFunction = createMatrix(size);

    function setFunctionModule(x, y, isDark) {
      modules[y][x] = isDark ? 1 : 0;
      isFunction[y][x] = 1;
    }

    function drawFinderPattern(cx, cy) {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const xx = cx + dx;
          const yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    function drawAlignmentPattern(cx, cy) {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunctionModule(cx + dx, cy + dy, dist !== 1);
        }
      }
    }

    function drawFormatBits(targetModules, mask) {
      const data = (ecl.formatBits << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i += 1) {
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      }
      const bits = ((data << 10) | rem) ^ 0x5412;

      function setFmt(x, y, bit) {
        targetModules[y][x] = bit;
        isFunction[y][x] = 1;
      }

      for (let i = 0; i <= 5; i += 1) setFmt(8, i, (bits >>> i) & 1);
      setFmt(8, 7, (bits >>> 6) & 1);
      setFmt(8, 8, (bits >>> 7) & 1);
      setFmt(7, 8, (bits >>> 8) & 1);
      for (let i = 9; i < 15; i += 1) setFmt(14 - i, 8, (bits >>> i) & 1);

      for (let i = 0; i < 8; i += 1) setFmt(size - 1 - i, 8, (bits >>> i) & 1);
      for (let i = 8; i < 15; i += 1) setFmt(8, size - 15 + i, (bits >>> i) & 1);
      setFmt(8, size - 8, 1); // Always-dark module
    }

    function drawVersionBits() {
      if (ver < 7) return;
      let rem = ver;
      for (let i = 0; i < 12; i += 1) {
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      }
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i += 1) {
        const bit = (bits >>> i) & 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunctionModule(a, b, bit);
        setFunctionModule(b, a, bit);
      }
    }

    // 1. Timing patterns
    for (let i = 0; i < size; i += 1) {
      setFunctionModule(6, i, i % 2 === 0);
      setFunctionModule(i, 6, i % 2 === 0);
    }

    // 2. Three Finder patterns
    drawFinderPattern(3, 3);
    drawFinderPattern(size - 4, 3);
    drawFinderPattern(3, size - 4);

    // 3. Alignment patterns
    const alignPos = getAlignmentPatternPositions(ver);
    for (let i = 0; i < alignPos.length; i += 1) {
      for (let j = 0; j < alignPos.length; j += 1) {
        const isFinderCorner =
          (i === 0 && j === 0) ||
          (i === 0 && j === alignPos.length - 1) ||
          (i === alignPos.length - 1 && j === 0);
        if (!isFinderCorner) {
          drawAlignmentPattern(alignPos[i], alignPos[j]);
        }
      }
    }

    // 4. Reserve Format & Version areas
    drawFormatBits(modules, 0);
    drawVersionBits();

    // 5. Place data + ECC codewords in zigzag order
    const allCodewords = encodeDataAndEcc(bytes, ver, ecl);
    let bitIdx = 0;
    const totalBits = allCodewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              bit = (allCodewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
              bitIdx += 1;
            }
            modules[y][x] = bit;
          }
        }
      }
    }

    // 6. Choose optimal mask among 8 ISO masks
    function applyMask(base, mask) {
      const m = cloneMatrix(base);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (isFunction[y][x]) continue;
          let invert = false;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          }
          if (invert) m[y][x] ^= 1;
        }
      }
      drawFormatBits(m, mask);
      return m;
    }

    function finderPenaltyCount(runHistory) {
      const n = runHistory[1];
      const core =
        n > 0 &&
        runHistory[2] === n &&
        runHistory[3] === n * 3 &&
        runHistory[4] === n &&
        runHistory[5] === n;
      return (
        (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
        (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
      );
    }

    function computePenalty(m) {
      let result = 0;

      // Rule 1 & Rule 3: rows
      for (let y = 0; y < size; y += 1) {
        let runColor = 0;
        let runX = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < size; x += 1) {
          if (m[y][x] === runColor) {
            runX += 1;
            if (runX === 5) result += 3;
            else if (runX > 5) result += 1;
          } else {
            hist.pop();
            hist.unshift(runX);
            if (!runColor) result += finderPenaltyCount(hist) * 40;
            runColor = m[y][x];
            runX = 1;
          }
        }
        hist.pop();
        hist.unshift(runX);
        if (runColor) {
          hist.pop();
          hist.unshift(0);
        }
        result += finderPenaltyCount(hist) * 40;
      }

      // Rule 1 & Rule 3: columns
      for (let x = 0; x < size; x += 1) {
        let runColor = 0;
        let runY = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < size; y += 1) {
          if (m[y][x] === runColor) {
            runY += 1;
            if (runY === 5) result += 3;
            else if (runY > 5) result += 1;
          } else {
            hist.pop();
            hist.unshift(runY);
            if (!runColor) result += finderPenaltyCount(hist) * 40;
            runColor = m[y][x];
            runY = 1;
          }
        }
        hist.pop();
        hist.unshift(runY);
        if (runColor) {
          hist.pop();
          hist.unshift(0);
        }
        result += finderPenaltyCount(hist) * 40;
      }

      // Rule 2: 2x2 blocks
      for (let y = 0; y < size - 1; y += 1) {
        for (let x = 0; x < size - 1; x += 1) {
          const c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) {
            result += 3;
          }
        }
      }

      // Rule 4: dark/light balance
      let dark = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          dark += m[y][x];
        }
      }
      const total = size * size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      result += Math.max(0, k) * 10;

      return result;
    }

    let bestMask = 0;
    let bestMatrix = null;
    let minPenalty = Infinity;

    for (let mask = 0; mask < 8; mask += 1) {
      const candidate = applyMask(modules, mask);
      const penalty = computePenalty(candidate);
      if (penalty < minPenalty) {
        minPenalty = penalty;
        bestMask = mask;
        bestMatrix = candidate;
      }
    }

    return {
      version: ver,
      size,
      mask: bestMask,
      ecl: eclName || 'H',
      modules: bestMatrix,
    };
  }

  global.QREngine = {
    generate: buildQrMatrix,
  };
})(typeof window !== 'undefined' ? window : globalThis);

