"use client";

import { useMemo, useRef, useState } from "react";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { ProjectContentRenderer } from "@/components/projects/project-content-renderer";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import {
  BLOCK_TYPES,
  createArrayEntry,
  createBlock,
  isLocalizedPair,
  textValue,
  updateAtPath,
  type BlockType,
  type ContentType,
  type Locale,
  type Snapshot,
} from "./admin-model";
import styles from "./admin.module.css";

const friendlyLabels: Record<string, string> = {
  about: "About",
  achievedAt: "Achievement date",
  authorName: "Author name",
  blogPost: "Blog post",
  careerObjective: "Career objective",
  content: "Markdown content",
  contentBlocks: "Content blocks",
  coverImageUrl: "Cover image URL",
  cvUrl: "CV URL",
  defaultDescription: "Default SEO description",
  defaultLocale: "Default language",
  defaultOgImageUrl: "Default OG image URL",
  defaultTitle: "Default SEO title",
  displayOrder: "Display order",
  email: "Email address",
  featured: "Featured on homepage",
  fullName: "Full name",
  githubUrl: "GitHub URL",
  linkedInUrl: "LinkedIn URL",
  readingTimeMinutes: "Reading time (minutes)",
  siteName: "Site name",
  techStack: "Tech stack",
  thumbnailUrl: "Project thumbnail URL",
};

function labelFor(value: string | number) {
  const key = String(value);
  return friendlyLabels[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function atPath(root: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((value, key) => {
    if (Array.isArray(value)) return value[Number(key)];
    if (typeof value === "object" && value !== null) return (value as Snapshot)[String(key)];
    return undefined;
  }, root);
}

function isLongText(name: string) {
  return ["about", "summary", "description", "careerObjective", "content", "body", "defaultDescription"].includes(name);
}

function isMarkdown(name: string) {
  return name === "content" || name === "body";
}

function cloneWithFreshIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneWithFreshIds);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "id" ? globalThis.crypto.randomUUID() : cloneWithFreshIds(child),
  ]));
}

function MarkdownInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [preview, setPreview] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actions: Array<{ label: string; title: string; before: string; after: string }> = [
    { label: "H2", title: "Heading", before: "## ", after: "" },
    { label: "B", title: "Bold", before: "**", after: "**" },
    { label: "I", title: "Italic", before: "_", after: "_" },
    { label: "Link", title: "Link", before: "[", after: "](https://)" },
    { label: "Code", title: "Inline code", before: "`", after: "`" },
    { label: "List", title: "List item", before: "- ", after: "" },
    { label: "Block", title: "Code block", before: "```text\n", after: "\n```" },
    { label: "Table", title: "Table", before: "| Column | Value |\n| --- | --- |\n|  |  |", after: "" },
    { label: "Image", title: "Image URL", before: "![Alt text](", after: ")" },
  ];

  const apply = (before: string, after: string) => {
    const element = inputRef.current;
    const selectionStart = element?.selectionStart ?? value.length;
    const selectionEnd = element?.selectionEnd ?? value.length;
    const selected = value.slice(selectionStart, selectionEnd) || (after ? "text" : "");
    const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      const cursor = selectionStart + before.length + selected.length;
      element?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className={styles.markdownField}>
      <div className={styles.markdownToolbar}>
        <span>{label}</span>
        <div className={styles.toolbarActions}>
          {actions.map((action) => (
            <button key={action.title} type="button" title={action.title} onClick={() => apply(action.before, action.after)}>
              {action.label}
            </button>
          ))}
          <button type="button" aria-pressed={preview} onClick={() => setPreview((current) => !current)}>
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>
      {preview ? (
        <div className={styles.markdownPreview}>
          <MarkdownContent content={value} />
        </div>
      ) : (
        <textarea
          ref={inputRef}
          aria-label={label}
          className={styles.markdownTextarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write Markdown…"
          rows={8}
        />
      )}
    </div>
  );
}

function FieldValue({
  value,
  path,
  snapshot,
  onChange,
}: {
  value: unknown;
  path: Array<string | number>;
  snapshot: Snapshot;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) {
  const name = path[path.length - 1] ?? "Value";
  const label = labelFor(name);
  const parent = atPath(snapshot, path.slice(0, -1));

  if (isLocalizedPair(value)) {
    if (Array.isArray(value.en) && Array.isArray(value.vi)) {
      return (
        <fieldset className={styles.localizedFields}>
          <legend>{label}</legend>
          {(["en", "vi"] as const).map((locale) => (
            <label className={styles.field} key={locale}>
              <span>{locale === "en" ? "English" : "Tiếng Việt"}</span>
              <textarea
                value={(value[locale] as string[]).join("\n")}
                onChange={(event) => onChange(path, {
                  ...value,
                  [locale]: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                })}
                rows={Math.min(6, Math.max(3, value[locale].length + 1))}
              />
              <small>One item per line. Editing this language keeps the other language unchanged.</small>
            </label>
          ))}
        </fieldset>
      );
    }
    return (
      <fieldset className={styles.localizedFields}>
        <legend>{label}</legend>
        {(["en", "vi"] as const).map((locale) => (
          <label className={styles.field} key={locale}>
            <span>{locale === "en" ? "English" : "Tiếng Việt"}</span>
            {isMarkdown(String(name)) ? (
              <MarkdownInput
                label={`${label} · ${locale === "en" ? "English" : "Tiếng Việt"}`}
                value={value[locale] as string}
                onChange={(next) => onChange(path, { ...value, [locale]: next })}
              />
            ) : isLongText(String(name)) ? (
              <textarea
                value={value[locale] as string}
                onChange={(event) => onChange(path, { ...value, [locale]: event.target.value })}
                rows={4}
              />
            ) : (
              <input
                value={value[locale] as string}
                onChange={(event) => onChange(path, { ...value, [locale]: event.target.value })}
              />
            )}
          </label>
        ))}
        <small>English and Vietnamese are stored as separate values.</small>
      </fieldset>
    );
  }

  if (Array.isArray(value)) {
    const isBlockList = name === "contentBlocks";
    return (
      <section className={styles.arrayEditor} aria-label={label}>
        <div className={styles.arrayHeading}>
          <div>
            <h3>{label}</h3>
            <span>{value.length} {value.length === 1 ? "item" : "items"}</span>
          </div>
          {isBlockList ? (
            <BlockAdder onAdd={(type) => onChange(path, [...value, createBlock(type)])} />
          ) : (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => onChange(path, [...value, createArrayEntry(String(name), typeof parent === "object" && parent !== null ? parent as Snapshot : {})])}
            >
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add item
            </button>
          )}
        </div>
        {value.length === 0 ? (
          <p className={styles.inlineEmpty}>Nothing here yet. Add an item to build this section.</p>
        ) : (
          <div className={styles.arrayRows}>
            {value.map((item, index) => {
              const itemLabel = item && typeof item === "object" && !Array.isArray(item)
                ? ((item as Snapshot).type as string | undefined) ??
                  textValue((item as Snapshot).title ?? (item as Snapshot).label ?? (item as Snapshot).name, "en") ??
                  `${labelFor(String(name).replace(/s$/, ""))} ${index + 1}`
                : `${labelFor(String(name).replace(/s$/, ""))} ${index + 1}`;
              const rearrange = (offset: number) => {
                const next = [...value];
                const target = index + offset;
                if (target < 0 || target >= next.length) return;
                [next[index], next[target]] = [next[target], next[index]];
                onChange(path, next);
              };
              const replaceItem = (nextItem: unknown) => {
                const next = [...value];
                next[index] = nextItem;
                onChange(path, next);
              };
              return (
                <article className={styles.arrayRow} key={`${String((item as Snapshot | null)?.id ?? index)}-${index}`}>
                  <details open={index === 0}>
                    <summary>
                      <span>{itemLabel}</span>
                      <span className={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</span>
                    </summary>
                    <div className={styles.nestedFields}>
                      <FieldValue value={item} path={[...path, index]} snapshot={snapshot} onChange={onChange} />
                    </div>
                  </details>
                  <div className={styles.rowControls} aria-label={`Actions for ${itemLabel}`}>
                    <button type="button" aria-label={`Move ${itemLabel} up`} disabled={index === 0} onClick={() => rearrange(-1)}>↑</button>
                    <button type="button" aria-label={`Move ${itemLabel} down`} disabled={index === value.length - 1} onClick={() => rearrange(1)}>↓</button>
                    <button type="button" aria-label={`Duplicate ${itemLabel}`} onClick={() => replaceItem(cloneWithFreshIds(item))}>⧉</button>
                    <button
                      type="button"
                      className={styles.removeButton}
                      aria-label={`Remove ${itemLabel}`}
                      onClick={() => {
                        if (!window.confirm(`Remove ${itemLabel} from this draft?`)) return;
                        onChange(path, value.filter((_, itemIndex) => itemIndex !== index));
                      }}
                    >
                      ×
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  if (typeof value === "object" && value !== null) {
    const fields = Object.entries(value as Snapshot);
    const isBlock = typeof (value as Snapshot).type === "string";
    return (
      <fieldset className={isBlock ? styles.blockFields : styles.objectFields}>
        {isBlock ? <legend>{String((value as Snapshot).type).replaceAll("_", " ")}</legend> : null}
        <div className={styles.fieldGrid}>
          {fields.map(([key, child]) => {
            const childPath = [...path, key];
            if (key === "id") {
              return (
                <label className={styles.field} key={key}>
                  <span>{labelFor(key)} <small>managed</small></span>
                  <input value={String(child)} readOnly aria-readonly="true" />
                </label>
              );
            }
            if (key === "type" && isBlock) {
              return (
                <label className={styles.field} key={key}>
                  <span>Block type</span>
                  <select
                    value={String(child)}
                    onChange={(event) => {
                      const type = event.target.value as BlockType;
                      if (!window.confirm("Changing the block type clears its current fields. Continue?")) return;
                      const oldBlock = value as Snapshot;
                      const replacement = createBlock(type);
                      replacement.id = oldBlock.id;
                      replacement.title = oldBlock.title;
                      onChange(path, replacement);
                    }}
                  >
                    {BLOCK_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
              );
            }
            if (typeof child === "boolean") {
              return (
                <label className={styles.checkField} key={key}>
                  <input
                    type="checkbox"
                    checked={child}
                    onChange={(event) => onChange(childPath, event.target.checked)}
                  />
                  <span>{labelFor(key)}</span>
                </label>
              );
            }
            return (
              <FieldValue key={key} value={child} path={childPath} snapshot={snapshot} onChange={onChange} />
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (typeof value === "boolean") {
    return (
      <label className={styles.checkField}>
        <input type="checkbox" checked={value} onChange={(event) => onChange(path, event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  if (typeof value === "number") {
    return (
      <label className={styles.field}>
        <span>{label}</span>
        <input type="number" min="0" value={value} onChange={(event) => onChange(path, Number(event.target.value))} />
      </label>
    );
  }

  const stringValue = typeof value === "string" ? value : "";
  if (String(name) === "id" || String(name) === "type") {
    return (
      <label className={styles.field}>
        <span>{label}</span>
        <input value={stringValue} readOnly aria-readonly="true" />
      </label>
    );
  }
  if (isLongText(String(name)) || stringValue.length > 180) {
    return (
      <label className={styles.field}>
        <span>{label}</span>
        <textarea
          value={stringValue}
          onChange={(event) => onChange(path, event.target.value)}
          rows={String(name) === "description" ? 4 : 3}
        />
      </label>
    );
  }
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input value={stringValue} onChange={(event) => onChange(path, event.target.value)} />
    </label>
  );
}

function BlockAdder({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [type, setType] = useState<BlockType>("MARKDOWN");
  return (
    <div className={styles.blockAdder}>
      <select aria-label="New content block type" value={type} onChange={(event) => setType(event.target.value as BlockType)}>
        {BLOCK_TYPES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
      </select>
      <button className={styles.quietButton} type="button" onClick={() => onAdd(type)}>
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
        Add block
      </button>
    </div>
  );
}

export function SnapshotEditor({
  snapshot,
  onChange,
}: {
  snapshot: Snapshot;
  onChange: (snapshot: Snapshot) => void;
}) {
  const rootFields = Object.entries(snapshot);
  return (
    <div className={styles.snapshotEditor}>
      <p className={styles.editorHint}>Edit English and Vietnamese separately. Saving here creates a Draft revision only; the published site stays unchanged.</p>
      <div className={styles.rootFieldGrid}>
        {rootFields.map(([key, value]) => (
          <FieldValue
            key={key}
            value={value}
            path={[key]}
            snapshot={snapshot}
            onChange={(path, replacement) => onChange(updateAtPath(snapshot, path, replacement) as Snapshot)}
          />
        ))}
      </div>
    </div>
  );
}

function localize(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Snapshot;
  if (Object.keys(record).length === 2 && "en" in record && "vi" in record) return localize(record[locale], locale);
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, localize(child, locale)]));
}

function Preview({ snapshot, type, locale }: { snapshot: Snapshot; type: ContentType; locale: Locale }) {
  const selected = useMemo(() => localize(snapshot, locale) as Snapshot, [snapshot, locale]);
  const selectedText = (key: string) => textValue(snapshot[key], locale);

  if (type === "blogPost") {
    return (
      <article className={styles.contentPreview}>
        <span className={styles.previewEyebrow}>{selectedText("publishedAt")}</span>
        <h2>{selectedText("title")}</h2>
        <p className={styles.previewLead}>{selectedText("summary")}</p>
        <BlogPostContent content={textValue(snapshot.content, locale)} />
      </article>
    );
  }

  if (type === "project") {
    const blocks = Array.isArray(selected.contentBlocks)
      ? selected.contentBlocks as LocalizedProjectContentBlock[]
      : [];
    return (
      <article className={styles.contentPreview}>
        <span className={styles.previewEyebrow}>{selected.slug as string}</span>
        <h2>{selected.title as string}</h2>
        <p className={styles.previewLead}>{selected.subtitle as string}</p>
        <p>{selected.description as string}</p>
        <div className={styles.previewTags}>
          {(selected.techStack as string[] | undefined)?.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <ProjectContentRenderer blocks={blocks} labels={{ viewProjectLinks: locale === "vi" ? "Xem liên kết" : "View project links" }} />
      </article>
    );
  }

  return (
    <article className={styles.contentPreview}>
      <span className={styles.previewEyebrow}>{type.replaceAll(/([A-Z])/g, " $1")}</span>
      <h2>{selectedText(type === "skills" ? "name" : type === "contactLink" ? "label" : "title") || selectedText("fullName") || selectedText("siteName")}</h2>
      {Object.entries(selected).map(([key, value]) => {
        if (["id", "title", "name", "fullName", "siteName", "featured", "displayOrder", "status", "slug"].includes(key)) return null;
        if (typeof value === "string" && value) {
          if (key === "content" || key === "about" || key === "summary") return <MarkdownContent key={key} content={value} />;
          return <p key={key}>{value}</p>;
        }
        if (Array.isArray(value)) {
          return <ul key={key}>{value.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul>;
        }
        return null;
      })}
    </article>
  );
}

export function DraftPreview({
  snapshot,
  type,
  onClose,
}: {
  snapshot: Snapshot;
  type: ContentType;
  onClose: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="preview-heading">
        <header className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>Draft preview</span>
            <h2 id="preview-heading">Preview content</h2>
          </div>
          <div className={styles.dialogActions}>
            <label className={styles.localeToggle}>
              <span className="sr-only">Preview language</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close preview">×</button>
          </div>
        </header>
        <div className={styles.previewCanvas}>
          <Preview snapshot={snapshot} type={type} locale={locale} />
        </div>
      </section>
    </div>
  );
}
