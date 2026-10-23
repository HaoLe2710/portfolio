import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  className?: string;
  content: string;
};

const markdownComponents: Components = {
  a: ({ children, href }) => {
    const isExternal = href?.startsWith("http");

    return (
      <a
        className="font-medium text-primary underline-offset-4 hover:underline"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-2 border-primary bg-muted/40 px-5 py-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        "font-mono text-[0.9em]",
        className
          ? "text-foreground"
          : "rounded-sm border border-border bg-muted px-1.5 py-0.5 text-foreground"
      )}
    >
      {children}
    </code>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 text-2xl font-semibold tracking-normal text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 text-xl font-semibold tracking-normal text-foreground">
      {children}
    </h3>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-5 text-muted-foreground">
      {children}
    </ol>
  ),
  p: ({ children }) => (
    <p className="my-4 leading-8 text-muted-foreground first:mt-0">
      {children}
    </p>
  ),
  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto border border-border bg-muted p-4 text-sm leading-7 text-foreground">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full min-w-96 border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 text-muted-foreground">
      {children}
    </td>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tr: ({ children }) => <tr>{children}</tr>,
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-5 text-muted-foreground">
      {children}
    </ul>
  ),
};

export function MarkdownContent({ className, content }: MarkdownContentProps) {
  return (
    <div className={cn("max-w-none text-base", className)}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
