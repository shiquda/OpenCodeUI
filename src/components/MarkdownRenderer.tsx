import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { detectLanguage } from '../utils/languageUtils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Inline code component
 */
const InlineCode = memo(function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-bg-300 rounded text-accent-main-100 text-[0.875em] font-mono">
      {children}
    </code>
  )
})

/**
 * Main Markdown renderer component
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  className = '' 
}: MarkdownRendererProps) {
  const components = useMemo(() => ({
    // Code blocks and inline code
    code({ className, children }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const contentStr = String(children).replace(/\n$/, '')
      const isMultiLine = contentStr.includes('\n')
      
      // 只有既没有语言标记，内容又是单行时，才认为是 inline code
      const isInline = !match && !className && !isMultiLine
      
      if (isInline) {
        return <InlineCode>{children}</InlineCode>
      }
      
      // Block code
      return (
        <div className="my-3 w-full">
          <CodeBlock code={contentStr} language={match?.[1]} />
        </div>
      )
    },
    
    // Prevent pre from wrapping code blocks (we handle it in CodeBlock)
    pre({ children }: any) {
      return <>{children}</>
    },
    
    // Headings
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-text-100 mt-6 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-bold text-text-100 mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-bold text-text-100 mt-4 mb-2 first:mt-0">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-bold text-text-100 mt-3 mb-1 first:mt-0">{children}</h4>
    ),
    
    // Paragraphs
    p: ({ children }: any) => (
      <p className="mb-3 last:mb-0 leading-7">{children}</p>
    ),
    
    // Lists
    ul: ({ children }: any) => (
      <ul className="list-disc list-outside ml-4 mb-3 space-y-1 marker:text-text-400">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-outside ml-4 mb-3 space-y-1 marker:text-text-400">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="text-text-200 pl-1">{children}</li>
    ),
    
    // Links
    a: ({ href, children }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-accent-main-100 hover:text-accent-main-200 hover:underline transition-colors"
      >
        {children}
      </a>
    ),
    
    // Blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-border-300 pl-4 py-1 text-text-300 italic my-4 bg-bg-200/30 rounded-r-lg">
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 border border-border-200 rounded-lg shadow-sm w-full">
        <table className="min-w-full border-collapse text-sm divide-y divide-border-200">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-bg-200">{children}</thead>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-2.5 text-left font-semibold text-text-200 whitespace-nowrap border-b border-border-200">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-2.5 text-text-300 whitespace-nowrap">{children}</td>
    ),
    
    // Horizontal rule
    hr: () => <hr className="border-border-200 my-6" />,
    
    // Strong and emphasis
    strong: ({ children }: any) => (
      <strong className="font-semibold text-text-100">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic">{children}</em>
    ),
    
    // Strikethrough (GFM)
    del: ({ children }: any) => (
      <del className="text-text-400 line-through">{children}</del>
    ),
  }), [])

  return (
    <div className={`markdown-content text-sm text-text-100 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

/**
 * Standalone code highlighter for tool previews
 * Uses file extension to determine language
 */
export const HighlightedCode = memo(function HighlightedCode({
  code,
  filePath,
  language,
  maxHeight,
  className = '',
}: {
  code: string
  filePath?: string
  language?: string
  maxHeight?: number
  className?: string
}) {
  const lang = useMemo(() => {
    return language || detectLanguage(filePath)
  }, [filePath, language])

  return (
    <div 
      className={`overflow-auto ${className}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <CodeBlock code={code} language={lang} />
    </div>
  )
})

export default MarkdownRenderer
