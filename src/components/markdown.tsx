'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'

interface MarkdownProps {
  content: string
  /** Dipanggil dengan index baris sumber saat checkbox task-list diklik */
  onToggleCheck?: (lineIndex: number) => void
  compact?: boolean
}

function MarkdownInner({ content, onToggleCheck, compact }: MarkdownProps) {
  const components: Components = {
    input: ({ node, checked, type, ...rest }) => {
      void type
      if (!onToggleCheck) {
        return <input type="checkbox" checked={!!checked} disabled readOnly {...rest} />
      }
      const line = (node?.position?.start?.line ?? 1) - 1
      return (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={() => onToggleCheck(line)}
          className="md-check"
          aria-label="Centang tugas"
          {...rest}
        />
      )
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const text = String(children)
      if (!match && !text.includes('\n')) {
        return (
          <code className="md-inline-code" {...props}>
            {children}
          </code>
        )
      }
      if (match) {
        return (
          <div className="md-codeblock">
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{ background: 'transparent', margin: 0, padding: '0.9rem', fontSize: '0.82rem' }}
            >
              {text.replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        )
      }
      return (
        <pre className="md-pre">
          <code>{children}</code>
        </pre>
      )
    },
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    ),
  }

  return (
    <div className={`md-body ${compact ? 'md-compact' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownInner)

/** Toggle checkbox pada baris ke-n dari konten markdown. */
export function toggleMarkdownCheck(content: string, line: number): string {
  const lines = content.split('\n')
  if (line < 0 || line >= lines.length) return content
  const l = lines[line]
  if (/\[ \]/.test(l)) lines[line] = l.replace('[ ]', '[x]')
  else lines[line] = l.replace(/\[[xX]\]/, '[ ]')
  return lines.join('\n')
}
