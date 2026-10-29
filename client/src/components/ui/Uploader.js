'use client'

import { useId, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './Button'

const MB = 1024 * 1024

/** Posts a file (or Blob) to Cloudinary with the API's signed params; resolves the result. */
export function uploadSigned(params, file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', params.apiKey)
    form.append('timestamp', String(params.timestamp))
    form.append('public_id', params.public_id)
    form.append('allowed_formats', params.allowed_formats)
    form.append('signature', params.signature)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', params.uploadUrl)
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () =>
      xhr.status < 300
        ? resolve(JSON.parse(xhr.responseText))
        : reject(new Error('The upload was refused'))
    xhr.onerror = () => reject(new Error('The upload failed; check your connection'))
    xhr.send(form)
  })
}

/**
 * Signed direct upload to Cloudinary (files never pass through the API). `sign()` returns the
 * API's signed params; `onUploaded({ publicId, altText })` saves the result. Alt text is
 * required when `requireAlt` (Part 4 §8).
 */
export function Uploader({
  label,
  sign,
  onUploaded,
  requireAlt = false,
  accept = 'image/jpeg,image/png,image/webp',
  altLabel = 'Describe the photo (for people who cannot see it)',
  buttonLabel = 'Upload',
  disabled = false,
}) {
  const id = useId()
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [altText, setAltText] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  const upload = async () => {
    setError(null)
    try {
      const params = await sign()
      if (file.size > params.maxBytes)
        throw new Error(`Choose a file up to ${Math.round(params.maxBytes / MB)} MB`)
      setProgress(0)
      const result = await uploadSigned(params, file, setProgress)
      await onUploaded({ publicId: result.public_id, altText: altText.trim() })
      setFile(null)
      setAltText('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err.details?.[0]?.message ?? err.message ?? 'Upload failed')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-box border border-dashed border-border p-4">
      <label htmlFor={`${id}-file`} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={`${id}-file`}
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {requireAlt && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-alt`} className="text-sm font-semibold">
            {altLabel}
          </label>
          <input
            id={`${id}-alt`}
            value={altText}
            maxLength={150}
            onChange={(e) => setAltText(e.target.value)}
            className="min-h-11 rounded-box border border-text-muted bg-surface px-3"
          />
        </div>
      )}
      {progress !== null && (
        <progress value={progress} max={100} className="w-full" aria-label="Upload progress">
          {progress}%
        </progress>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <Button
          onClick={upload}
          disabled={disabled || !file || (requireAlt && !altText.trim())}
          loading={progress !== null}
        >
          <Upload aria-hidden="true" className="size-4" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
