import React from 'react';
import { splitLinks } from '../utils/linkify';

/** Plain text with line breaks kept and web addresses made clickable. Nothing in the text is ever treated as markup. */
export const LinkedText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <p className={`whitespace-pre-wrap break-words ${className}`}>
    {splitLinks(text).map((part, i) =>
      part.type === 'link' ? (
        <a
          key={i}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-blue-700 dark:text-blue-400 underline underline-offset-2 break-all"
        >
          {part.value}
        </a>
      ) : (
        <React.Fragment key={i}>{part.value}</React.Fragment>
      )
    )}
  </p>
);
