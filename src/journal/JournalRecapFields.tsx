import { useRef, useState } from 'react'
import type { JournalRecap, JournalScreenshot } from '../api/journal.api'
import { JOURNAL_MISTAKE_TAGS, MAX_JOURNAL_SCREENSHOTS } from '../../shared/journalRecap.js'

import { readJournalScreenshot } from './journalImages'
import JournalScreenshotView from './JournalScreenshotView'

type Props = {
  recap: JournalRecap
  onChange: (patch: Partial<JournalRecap>) => void
  isDark: boolean
  inputClass: string
  onProcessing: (busy: boolean) => void
  captureChart?: () => Promise<JournalScreenshot>
}

export default function JournalRecapFields({
  recap,
  onChange,
  isDark,
  inputClass,
  onProcessing,
  captureChart,
}: Props) {
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const processingRef = useRef(false)
  const screenshots = recap.screenshots ?? []
  const appendImages = async (count: number, load: () => Promise<JournalScreenshot[]>) => {
    if (!count || processingRef.current) return
    setError('')
    if (screenshots.length + count > MAX_JOURNAL_SCREENSHOTS) {
      setError('Attach up to four screenshots per entry.')
      return
    }
    processingRef.current = true
    setProcessing(true)
    onProcessing(true)
    try {
      const images = await load()
      onChange({ screenshots: [...screenshots, ...images] })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The screenshot could not be read.')
    } finally {
      processingRef.current = false
      setProcessing(false)
      onProcessing(false)
    }
  }
  const labelClass = 'text-xs text-[#71717A]'
  return (
    <>
      <label className={labelClass}>
        Initial risk ($)
        <input
          aria-label="Initial risk dollars"
          type="number"
          min="0.01"
          step="any"
          value={recap.riskDollars ?? ''}
          onChange={(e) => onChange({ riskDollars: e.target.value })}
          placeholder="Optional; used for R analytics"
          className={`${inputClass} mt-1.5 w-full`}
        />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Setup title
        <input
          aria-label="Setup title"
          maxLength={160}
          value={recap.title ?? ''}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Setup #1 · London sweep into IFVG"
          className={`${inputClass} mt-1.5 w-full`}
        />
      </label>
      <label className={labelClass}>
        Session
        <select
          aria-label="Journal session"
          value={recap.session ?? ''}
          onChange={(event) => onChange({ session: event.target.value })}
          className={`${inputClass} mt-1.5 w-full`}
        >
          <option value="">Not specified</option>
          {['Asia', 'London', 'New York AM', 'New York PM', 'Other'].map((session) => (
            <option key={session}>{session}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Execution
        <select
          aria-label="Journal execution"
          value={recap.execution ?? 'taken'}
          onChange={(event) =>
            onChange({ execution: event.target.value as JournalRecap['execution'] })
          }
          className={`${inputClass} mt-1.5 w-full`}
        >
          <option value="taken">Taken</option>
          <option value="missed">Missed setup</option>
          <option value="observation">Observation / no trade</option>
        </select>
      </label>
      <label className={labelClass}>
        Process grade
        <select
          aria-label="Journal process grade"
          value={recap.grade ?? ''}
          onChange={(event) => onChange({ grade: event.target.value as JournalRecap['grade'] })}
          className={`${inputClass} mt-1.5 w-full`}
        >
          <option value="">Not reviewed</option>
          <option value="A">A · Followed my plan</option>
          <option value="B">B · Minor deviation</option>
          <option value="C">C · Broke my rules</option>
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className={`${labelClass} mb-2`}>Mistakes to review</legend>
        <div className="flex flex-wrap gap-2">
          {JOURNAL_MISTAKE_TAGS.map((tag) => (
            <label
              key={tag}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}
            >
              <input
                type="checkbox"
                checked={(recap.mistakeTags ?? []).includes(tag)}
                onChange={(event) =>
                  onChange({
                    mistakeTags: event.target.checked
                      ? [...(recap.mistakeTags ?? []), tag]
                      : (recap.mistakeTags ?? []).filter((item) => item !== tag),
                  })
                }
              />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={`${labelClass} sm:col-span-2`}>
        Lesson for next session
        <textarea
          aria-label="Lesson for next session"
          maxLength={8000}
          value={recap.lesson ?? ''}
          onChange={(event) => onChange({ lesson: event.target.value })}
          rows={3}
          placeholder="What worked, what failed, and one thing to repeat or change."
          className={`${inputClass} mt-1.5 !h-auto w-full resize-y py-2`}
        />
      </label>
      <fieldset className="sm:col-span-2" disabled={processing}>
        <legend className={`${labelClass} mb-2`}>Chart screenshots</legend>
        {captureChart && (
          <button
            type="button"
            disabled={processing || screenshots.length >= MAX_JOURNAL_SCREENSHOTS}
            onClick={() => void appendImages(1, async () => [await captureChart()])}
            className="mb-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Capture current chart
          </button>
        )}
        <p className="mb-3 text-xs text-[#71717A]">
          Add up to four before/after charts. Images are resized and saved privately with this
          entry.
        </p>
        <input
          aria-label="Attach chart screenshots"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => {
            void appendImages(event.target.files?.length ?? 0, () =>
              Promise.all(Array.from(event.target.files ?? []).map(readJournalScreenshot))
            )
            event.target.value = ''
          }}
          className="block w-full text-xs text-[#71717A] file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2"
        />
        {processing && (
          <p role="status" className="mt-2 text-xs text-[#71717A]">
            Preparing screenshots…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {screenshots.map((image, index) => (
            <div key={image.id} className="min-w-0">
              <JournalScreenshotView
                image={image}
                onChange={(updated) =>
                  onChange({
                    screenshots: screenshots.map((item, i) => (i === index ? updated : item)),
                  })
                }
              />
              <input
                aria-label={`Screenshot ${index + 1} caption`}
                maxLength={300}
                value={image.caption}
                onChange={(event) =>
                  onChange({
                    screenshots: screenshots.map((item, i) =>
                      i === index ? { ...item, caption: event.target.value } : item
                    ),
                  })
                }
                className={`${inputClass} mt-2 w-full`}
              />
              <button
                type="button"
                onClick={() => onChange({ screenshots: screenshots.filter((_, i) => i !== index) })}
                className="mt-1 text-xs text-red-500"
              >
                Remove screenshot {index + 1}
              </button>
            </div>
          ))}
        </div>
      </fieldset>
    </>
  )
}
