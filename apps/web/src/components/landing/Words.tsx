import { Fragment, type CSSProperties } from "react";

/**
 * A heading's words, each in its own span for a staggered entrance. Assistive technology reads the
 * whole text once; the split copy is decorative. Without JavaScript every word is simply visible.
 */
export function Words({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true" data-words="">
        {words.map((word, i) => (
          <Fragment key={i}>
            <span data-word="" style={{ "--w": i } as CSSProperties}>
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </>
  );
}
