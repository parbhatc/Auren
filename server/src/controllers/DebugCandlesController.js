import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { HTTP_STATUS } from '../config/constants.js'
import { mergeUdfChunks, slugForCandleDebug } from '../utils/mergeUdfCandles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data/debug-candles')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

function snapshotPath(slug) {
  return path.join(DATA_DIR, `${slug}.json`)
}

class DebugCandlesController {
  /** GET /debug/candles — list saved symbol/resolution snapshots */
  async list(req, res) {
    try {
      await ensureDataDir()
      const files = await fs.readdir(DATA_DIR)
      const snapshots = []
      for (const name of files) {
        if (!name.endsWith('.json')) continue
        try {
          const raw = await fs.readFile(path.join(DATA_DIR, name), 'utf8')
          const doc = JSON.parse(raw)
          snapshots.push({
            slug: name.replace(/\.json$/, ''),
            symbol: doc.symbol,
            resolution: doc.resolution,
            barCount: doc.merged?.t?.length ?? 0,
            chunkCount: doc.chunks?.length ?? 0,
            updatedAt: doc.updatedAt,
            timeMin: doc.merged?.t?.[0] ?? null,
            timeMax: doc.merged?.t?.[doc.merged.t.length - 1] ?? null,
          })
        } catch {
          snapshots.push({ slug: name.replace(/\.json$/, ''), corrupt: true })
        }
      }
      snapshots.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      res.status(HTTP_STATUS.OK).json({ success: true, snapshots })
    } catch (err) {
      console.error('[debug/candles] list failed:', err)
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err?.message || 'Failed to list candle debug snapshots',
      })
    }
  }

  /** GET /debug/candles/:slug — download merged UDF + metadata */
  async get(req, res) {
    try {
      const slug = String(req.params.slug || '').trim()
      if (!slug) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'slug required' })
      }
      const raw = await fs.readFile(snapshotPath(slug), 'utf8')
      const doc = JSON.parse(raw)
      res.status(HTTP_STATUS.OK).json({ success: true, ...doc })
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Snapshot not found' })
      }
      console.error('[debug/candles] get failed:', err)
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err?.message || 'Failed to read snapshot',
      })
    }
  }

  /** POST /debug/candles/chunk — append one getBars UDF payload (auto-merge) */
  async saveChunk(req, res) {
    try {
      const { symbol, resolution, from, to, udf, note } = req.body ?? {}
      if (!symbol || !resolution || !udf?.t?.length) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'symbol, resolution, and udf with t[] are required',
        })
      }

      await ensureDataDir()
      const slug = slugForCandleDebug(String(symbol), String(resolution))
      const filePath = snapshotPath(slug)
      let doc = {
        slug,
        symbol: String(symbol),
        resolution: String(resolution),
        chunks: [],
        merged: { s: 'ok', t: [], o: [], h: [], l: [], c: [], v: [] },
        updatedAt: null,
      }

      try {
        const existing = await fs.readFile(filePath, 'utf8')
        doc = JSON.parse(existing)
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err
      }

      const chunk = {
        from: Number(from) || null,
        to: Number(to) || null,
        barCount: udf.t.length,
        savedAt: new Date().toISOString(),
        note: note ? String(note) : undefined,
        udf: {
          s: udf.s ?? 'ok',
          t: udf.t,
          o: udf.o,
          h: udf.h,
          l: udf.l,
          c: udf.c,
          v: udf.v ?? udf.t.map(() => 0),
        },
      }

      doc.chunks.push(chunk)
      doc.merged = mergeUdfChunks(doc.chunks)
      doc.updatedAt = chunk.savedAt
      doc.userId = req.user?.id ?? doc.userId

      await fs.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf8')

      res.status(HTTP_STATUS.OK).json({
        success: true,
        slug,
        barCount: doc.merged.t.length,
        chunkCount: doc.chunks.length,
        timeMin: doc.merged.t[0] ?? null,
        timeMax: doc.merged.t[doc.merged.t.length - 1] ?? null,
      })
    } catch (err) {
      console.error('[debug/candles] saveChunk failed:', err)
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err?.message || 'Failed to save candle chunk',
      })
    }
  }

  /** POST /debug/candles/import — replace snapshot with multiple UDF chunks at once */
  async importSnapshot(req, res) {
    try {
      const { symbol, resolution, chunks, replace = true } = req.body ?? {}
      if (!symbol || !resolution || !Array.isArray(chunks) || chunks.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'symbol, resolution, and chunks[] are required',
        })
      }

      await ensureDataDir()
      const slug = slugForCandleDebug(String(symbol), String(resolution))
      const filePath = snapshotPath(slug)

      let prior = []
      if (!replace) {
        try {
          const existing = JSON.parse(await fs.readFile(filePath, 'utf8'))
          prior = existing.chunks ?? []
        } catch (err) {
          if (err?.code !== 'ENOENT') throw err
        }
      }

      const normalized = chunks.map((c, i) => ({
        from: c.from ?? null,
        to: c.to ?? null,
        barCount: c.udf?.t?.length ?? 0,
        savedAt: c.savedAt ?? new Date().toISOString(),
        note: c.note ?? `import-${i + 1}`,
        udf: c.udf ?? c,
      }))

      const allChunks = [...prior, ...normalized]
      const merged = mergeUdfChunks(allChunks)
      const doc = {
        slug,
        symbol: String(symbol),
        resolution: String(resolution),
        chunks: allChunks,
        merged,
        updatedAt: new Date().toISOString(),
        userId: req.user?.id,
      }

      await fs.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf8')

      res.status(HTTP_STATUS.OK).json({
        success: true,
        slug,
        barCount: merged.t.length,
        chunkCount: allChunks.length,
        timeMin: merged.t[0] ?? null,
        timeMax: merged.t[merged.t.length - 1] ?? null,
      })
    } catch (err) {
      console.error('[debug/candles] import failed:', err)
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err?.message || 'Failed to import candles',
      })
    }
  }

  /** DELETE /debug/candles/:slug */
  async remove(req, res) {
    try {
      const slug = String(req.params.slug || '').trim()
      await fs.unlink(snapshotPath(slug))
      res.status(HTTP_STATUS.OK).json({ success: true })
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Snapshot not found' })
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err?.message || 'Failed to delete snapshot',
      })
    }
  }
}

export default new DebugCandlesController()
