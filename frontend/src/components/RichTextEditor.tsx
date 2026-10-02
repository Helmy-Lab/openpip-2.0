import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

const MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
}

const FORMATS = ['header', 'bold', 'italic', 'underline', 'list', 'link']

export function RichTextEditor({ value, onChange, placeholder, rows = 8 }: RichTextEditorProps) {
  const minHeight = rows * 22

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--border-strong)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .ql-container { font-family: var(--font); font-size: 13px; }
        .ql-editor { min-height: ${minHeight}px; color: var(--text); }
        .ql-toolbar { background: var(--surface-2); border-bottom: 1px solid var(--border) !important; border: none; }
        .ql-container.ql-snow { border: none; }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value ?? ''}
        // Quill re-serialises the HTML it is given and reports that as a
        // change (source "api"), which marked a freshly loaded field as edited
        // and left "Save 1 change" showing. Only the admin's own edits count.
        onChange={(html, _delta, source) => {
          if (source === 'user') onChange(html)
        }}
        modules={MODULES}
        formats={FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
}
