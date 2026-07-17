import ReactMarkdown from "react-markdown";

/** Renders AI-generated Markdown (headers, bold, lists, hr) with the retro
 * theme's type scale instead of default browser/prose styling -- no
 * @tailwindcss/typography dependency needed for just a handful of elements. */
export function RetroMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: (props) => <h1 className="mt-3 mb-1.5 font-pixel text-lg first:mt-0" {...props} />,
        h2: (props) => <h2 className="mt-3 mb-1.5 font-pixel text-base first:mt-0" {...props} />,
        h3: (props) => <h3 className="mt-2.5 mb-1 text-[12px] font-bold" {...props} />,
        p: (props) => <p className="mb-2 text-[11px] leading-relaxed" {...props} />,
        ul: (props) => <ul className="mb-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed" {...props} />,
        ol: (props) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-[11px] leading-relaxed" {...props} />,
        li: (props) => <li {...props} />,
        strong: (props) => <strong className="font-bold text-foreground" {...props} />,
        hr: () => <hr className="my-3 border-border" />,
        a: (props) => <a className="text-retro-purple hover:underline" target="_blank" rel="noreferrer" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
